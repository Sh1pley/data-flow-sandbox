import { mockFetchAuthToken, mockFetchProducts, csvLookupInventory } from '../mocks/sources.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Condition that splits rows into two paths
const IS_HEALTHY_STOCK = (item) => item.stock >= 75;

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

export async function runFlow(updateNode, updateEdge) {
  const stats = { totalApiCalls: 0, pathARows: 0, pathBRows: 0, finalRows: 0 };

  // ─── 1. Auth Token ────────────────────────────────────────────────────────
  updateNode('auth', { status: 'running' });
  await pause(200);
  const authResult = await mockFetchAuthToken();
  stats.totalApiCalls += 1;
  updateNode('auth', {
    status: 'done',
    output: [{ token: authResult.token.slice(0, 28) + '…', expires_in: authResult.expires_in }],
    stats: { outputRows: 1, apiCalls: 1 },
  });
  stampEdge(updateEdge, 'auth-products', 'auth token', '#7c3aed');
  glow(updateEdge, 'auth-products', '#7c3aed');
  await pause(500);

  // ─── 2. Products API ──────────────────────────────────────────────────────
  updateNode('products', { status: 'running' });
  const products = await mockFetchProducts(authResult.token);
  stats.totalApiCalls += 1;
  updateNode('products', {
    status: 'done',
    output: products,
    stats: { outputRows: products.length, apiCalls: 1 },
  });
  stampEdge(updateEdge, 'auth-products', 'auth token', '#7c3aed');
  stampEdge(updateEdge, 'products-filter', `${products.length} rows · 5 fields`);
  glow(updateEdge, 'products-filter');
  await pause(500);

  // ─── 3. Price Filter (>= $75) ─────────────────────────────────────────────
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

  // ─── 5. Branch — split by stock level ────────────────────────────────────
  //
  // Each row goes to exactly ONE path. Path A + Path B = total in.
  // No rows are created or destroyed — the merge node verifies this.
  //
  updateNode('branch', { status: 'running' });
  await pause(450);
  const pathAItems = withInventory.filter(IS_HEALTHY_STOCK);
  const pathBItems = withInventory.filter((item) => !IS_HEALTHY_STOCK(item));

  updateNode('branch', {
    status: 'done',
    output: withInventory,
    stats: {
      inputRows: withInventory.length,
      pathARows: pathAItems.length,
      pathBRows: pathBItems.length,
    },
  });

  stampEdge(updateEdge, 'csv-branch', `${withInventory.length} rows · 8 fields`);
  stampEdge(updateEdge, 'branch-pathA', `${pathAItems.length} rows`, '#4ade80');
  stampEdge(updateEdge, 'branch-pathB', `${pathBItems.length} rows`, '#fb923c');
  glow(updateEdge, 'branch-pathA', '#4ade80');
  glow(updateEdge, 'branch-pathB', '#fb923c');
  await pause(500);

  // ─── 6 & 7. Path transforms (sequential here, conceptually parallel) ─────
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

  updateNode('pathB', { status: 'running' });
  await pause(350);
  const pathBResult = pathBItems.map((item) =>
    Object.assign({}, item, {
      badge: `Only ${item.stock} left!`,
      display_price: Math.round(item.price * 0.9 * 100) / 100,
      campaign_tag: 'clearance',
      urgent: true,
    })
  );
  updateNode('pathB', {
    status: 'done',
    output: pathBResult,
    stats: { inputRows: pathBItems.length, outputRows: pathBResult.length },
  });

  stampEdge(updateEdge, 'branch-pathA', `${pathAResult.length} rows`, '#4ade80');
  stampEdge(updateEdge, 'branch-pathB', `${pathBResult.length} rows`, '#fb923c');
  stampEdge(updateEdge, 'pathA-merge', `${pathAResult.length} rows`, '#4ade80');
  stampEdge(updateEdge, 'pathB-merge', `${pathBResult.length} rows`, '#fb923c');
  glow(updateEdge, 'pathA-merge', '#4ade80');
  glow(updateEdge, 'pathB-merge', '#fb923c');
  await pause(500);

  // ─── 8. Merge — combine both paths ───────────────────────────────────────
  //
  // pathAResult.length + pathBResult.length === withInventory.length
  // This is the proof that branching is lossless.
  //
  updateNode('merge', { status: 'running' });
  await pause(400);
  const merged = [...pathAResult, ...pathBResult];

  stats.pathARows = pathAResult.length;
  stats.pathBRows = pathBResult.length;
  stats.finalRows  = merged.length;

  updateNode('merge', {
    status: 'done',
    output: merged,
    stats: {
      pathARows: pathAResult.length,
      pathBRows: pathBResult.length,
      outputRows: merged.length,
    },
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
