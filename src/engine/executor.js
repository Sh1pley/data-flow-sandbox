import { mockFetchAuthToken, mockFetchProducts, csvLookupInventory } from '../mocks/sources.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const stampEdge = (updateEdge, id, label, color = '#334155') =>
  updateEdge(id, {
    animated: false,
    style: { stroke: color, strokeWidth: 1.5 },
    label,
    labelStyle: { fill: color === '#334155' ? '#64748b' : color, fontSize: 9 },
    labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
    labelBgPadding: [3, 5],
    labelBgBorderRadius: 4,
  });

const glow = (updateEdge, id, color = '#38bdf8') =>
  updateEdge(id, { animated: true, style: { stroke: color, strokeWidth: 2 } });

/**
 * runFlow — executes the demo pipeline.
 *
 * updateNode(id, partial)   — patches a node's React state
 * updateEdge(id, partial)   — patches an edge's React state
 * setGlobal(key, meta)      — adds/updates a key in the global scope panel
 *
 * Two kinds of globals are demonstrated:
 *   - Pre-set (env-var style): stock_threshold, campaign_name — exist before the flow runs
 *   - Promoted at runtime: auth_token (from Auth), max_price (from Products API)
 *
 * The Branch reads $stock_threshold.
 * The Urgency transform reads $campaign_name.
 * Every API node reads $auth_token.
 * This all happens without those values being in the carry-forward chain.
 */
export async function runFlow(updateNode, updateEdge, setGlobal) {
  const stats = { totalApiCalls: 0, pathARows: 0, pathBRows: 0, finalRows: 0 };

  // ── The globals store lives here in the executor ───────────────────────────
  // Pre-set globals are seeded before any node runs (env-var style).
  // They are already visible in the UI via INITIAL_GLOBALS in App.jsx.
  const globals = {
    stock_threshold: 75,
    campaign_name: 'Spring Sale',
  };

  const promote = (key, value, source, usedBy = []) => {
    globals[key] = value;
    setGlobal(key, { value, source, status: 'active', usedBy });
  };

  const markReading = (key, usedBy) => {
    setGlobal(key, { value: globals[key], source: undefined, status: 'reading', usedBy });
  };

  // ─── 1. Auth Token — promotes $auth_token to globals ─────────────────────
  updateNode('auth', { status: 'running' });
  await pause(200);
  const authResult = await mockFetchAuthToken();
  stats.totalApiCalls += 1;

  promote('auth_token', authResult.token.slice(0, 22) + '…', 'OAuth Token', ['Products API', 'any future API node']);

  updateNode('auth', {
    status: 'done',
    output: [{ token: authResult.token.slice(0, 28) + '…', expires_in: authResult.expires_in }],
    stats: { outputRows: 1, apiCalls: 1 },
    globalsWrite: ['auth_token'],
  });
  stampEdge(updateEdge, 'auth-products', 'auth token', '#7c3aed');
  glow(updateEdge, 'auth-products', '#7c3aed');
  await pause(500);

  // ─── 2. Products API — reads $auth_token, promotes $max_price ────────────
  markReading('auth_token', ['Products API']);
  updateNode('products', { status: 'running' });
  const products = await mockFetchProducts(authResult.token);
  stats.totalApiCalls += 1;

  const maxPrice = Math.max(...products.map((p) => p.price));
  promote('max_price', maxPrice, 'Products API', []);
  promote('total_in_catalog', products.length, 'Products API', ['informational']);

  updateNode('products', {
    status: 'done',
    output: products,
    stats: { outputRows: products.length, apiCalls: 1 },
    globalsRead:  ['auth_token'],
    globalsWrite: ['max_price', 'total_in_catalog'],
  });
  stampEdge(updateEdge, 'auth-products', 'auth token', '#7c3aed');
  stampEdge(updateEdge, 'products-filter', `${products.length} rows · 5 fields`);
  glow(updateEdge, 'products-filter');
  await pause(500);

  // ─── 3. Price Filter ──────────────────────────────────────────────────────
  updateNode('filter', { status: 'running' });
  await pause(350);
  const filtered = products.filter((p) => p.price >= 75);
  updateNode('filter', {
    status: 'done',
    output: filtered,
    stats: { inputRows: products.length, outputRows: filtered.length },
  });
  stampEdge(updateEdge, 'products-filter', `${products.length} rows · 5 fields`);
  stampEdge(updateEdge, 'filter-csv', `${filtered.length} rows · 5 fields`);
  glow(updateEdge, 'filter-csv');
  await pause(500);

  // ─── 4. CSV Inventory Join ────────────────────────────────────────────────
  updateNode('csv', { status: 'running' });
  await pause(300);
  const withInventory = filtered.map((item) =>
    Object.assign({}, item, csvLookupInventory(item.sku))
  );
  updateNode('csv', {
    status: 'done',
    output: withInventory,
    stats: { inputRows: filtered.length, outputRows: withInventory.length, apiCalls: 0 },
  });
  stampEdge(updateEdge, 'filter-csv', `${filtered.length} rows · 5 fields`);
  stampEdge(updateEdge, 'csv-branch', `${withInventory.length} rows · 8 fields`);
  glow(updateEdge, 'csv-branch');
  await pause(500);

  // ─── 5. Branch — reads $stock_threshold from globals ─────────────────────
  //
  // The branch condition is NOT hardcoded — it reads from $stock_threshold.
  // Changing that global (e.g., from a business-rules API) changes routing
  // without touching the graph.
  //
  markReading('stock_threshold', ['Branch']);
  updateNode('branch', { status: 'running' });
  await pause(450);

  const threshold = globals.stock_threshold;           // ← reads the global
  const pathAItems = withInventory.filter((i) => i.stock >= threshold);
  const pathBItems = withInventory.filter((i) => i.stock < threshold);

  updateNode('branch', {
    status: 'done',
    output: withInventory,
    stats: { inputRows: withInventory.length, pathARows: pathAItems.length, pathBRows: pathBItems.length },
    globalsRead: ['stock_threshold'],
  });
  stampEdge(updateEdge, 'csv-branch', `${withInventory.length} rows · 8 fields`);
  stampEdge(updateEdge, 'branch-pathA', `${pathAItems.length} rows`, '#4ade80');
  stampEdge(updateEdge, 'branch-pathB', `${pathBItems.length} rows`, '#fb923c');
  glow(updateEdge, 'branch-pathA', '#4ade80');
  glow(updateEdge, 'branch-pathB', '#fb923c');
  await pause(500);

  // ─── 6. Premium Path — no global reads ───────────────────────────────────
  updateNode('pathA', { status: 'running' });
  await pause(350);
  const pathAResult = pathAItems.map((item) =>
    Object.assign({}, item, {
      badge: 'In Stock',
      display_price: item.price,
      campaign_tag: 'premium',
      urgent: false,
    })
  );
  updateNode('pathA', {
    status: 'done',
    output: pathAResult,
    stats: { inputRows: pathAItems.length, outputRows: pathAResult.length },
  });

  // ─── 7. Urgency Path — reads $campaign_name from globals ─────────────────
  //
  // The badge text uses $campaign_name — a pre-set global that could be
  // driven by a CMS or business-rules API without changing this node.
  //
  markReading('campaign_name', ['Urgency Path']);
  updateNode('pathB', { status: 'running' });
  await pause(350);
  const campaignName = globals.campaign_name;           // ← reads the global
  const pathBResult = pathBItems.map((item) =>
    Object.assign({}, item, {
      badge: `[${campaignName}] Only ${item.stock} left!`,
      display_price: Math.round(item.price * 0.9 * 100) / 100,
      campaign_tag: 'clearance',
      urgent: true,
    })
  );
  updateNode('pathB', {
    status: 'done',
    output: pathBResult,
    stats: { inputRows: pathBItems.length, outputRows: pathBResult.length },
    globalsRead: ['campaign_name'],
  });

  stampEdge(updateEdge, 'branch-pathA', `${pathAResult.length} rows`, '#4ade80');
  stampEdge(updateEdge, 'branch-pathB', `${pathBResult.length} rows`, '#fb923c');
  stampEdge(updateEdge, 'pathA-merge', `${pathAResult.length} rows`, '#4ade80');
  stampEdge(updateEdge, 'pathB-merge', `${pathBResult.length} rows`, '#fb923c');
  glow(updateEdge, 'pathA-merge', '#4ade80');
  glow(updateEdge, 'pathB-merge', '#fb923c');
  await pause(500);

  // ─── 8. Merge ────────────────────────────────────────────────────────────
  updateNode('merge', { status: 'running' });
  await pause(400);
  const merged = [...pathAResult, ...pathBResult];
  stats.pathARows  = pathAResult.length;
  stats.pathBRows  = pathBResult.length;
  stats.finalRows  = merged.length;

  updateNode('merge', {
    status: 'done',
    output: merged,
    stats: { pathARows: pathAResult.length, pathBRows: pathBResult.length, outputRows: merged.length },
  });
  stampEdge(updateEdge, 'pathA-merge', `${pathAResult.length} rows`, '#4ade80');
  stampEdge(updateEdge, 'pathB-merge', `${pathBResult.length} rows`, '#fb923c');
  stampEdge(updateEdge, 'merge-result', `${merged.length} rows · 12 fields`);
  glow(updateEdge, 'merge-result');
  await pause(500);

  // ─── 9. Result ────────────────────────────────────────────────────────────
  updateNode('result', { status: 'running' });
  await pause(300);
  updateNode('result', {
    status: 'done',
    description: `${merged.length} rows · 12 fields`,
    output: merged,
    stats: { outputRows: merged.length },
  });

  return stats;
}
