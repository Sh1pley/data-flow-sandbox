import {
  mockFetchAuthToken,
  mockFetchProducts,
  mockFetchBrand,
  csvLookupInventory,
} from '../mocks/sources.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Executes the hardcoded demo flow step by step.
 *
 * updateNode(id, partialData) — merges into that node's data in React state
 * updateEdge(id, partial)     — merges into that edge in React state
 *
 * Returns aggregate execution stats on completion.
 */
export async function runFlow(updateNode, updateEdge) {
  const stats = { totalApiCalls: 0, dedupSaved: 0, finalRows: 0 };

  const activateEdge = (id) => updateEdge(id, { animated: true, style: { stroke: '#38bdf8', strokeWidth: 2 } });

  // After data flows through an edge, label it with row count + cumulative field count
  const stampEdge = (id, rows, label) => updateEdge(id, {
    animated: false,
    style: { stroke: '#334155', strokeWidth: 1.5 },
    label,
    labelStyle: { fill: '#64748b', fontSize: 9 },
    labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
    labelBgPadding: [3, 5],
    labelBgBorderRadius: 4,
  });

  const deactivateEdge = (id) => updateEdge(id, { animated: false, style: { stroke: '#334155', strokeWidth: 1.5 } });

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

  stampEdge('auth-products', 1, 'auth token');
  activateEdge('auth-products');
  await pause(400);

  // ─── 2. Products API ──────────────────────────────────────────────────────
  updateNode('products', { status: 'running' });
  deactivateEdge('auth-products');

  const products = await mockFetchProducts(authResult.token);
  stats.totalApiCalls += 1;

  updateNode('products', {
    status: 'done',
    output: products,
    stats: { outputRows: products.length, apiCalls: 1 },
  });

  stampEdge('products-filter', products.length, `${products.length} rows · 5 fields`);
  activateEdge('products-filter');
  await pause(400);

  // ─── 3. Price Filter (>= $75) ─────────────────────────────────────────────
  updateNode('filter', { status: 'running' });
  deactivateEdge('products-filter');
  await pause(350);

  const filtered = products.filter((p) => p.price >= 75);

  updateNode('filter', {
    status: 'done',
    output: filtered,
    stats: { inputRows: products.length, outputRows: filtered.length },
  });

  stampEdge('filter-brand', filtered.length, `${filtered.length} rows · 5 fields`);
  activateEdge('filter-brand');
  await pause(400);

  // ─── 4. Brand API — deduplicate by brand_id ───────────────────────────────
  //
  // 7 items come in. Without dedup: 7 API calls.
  // Unique brand_ids: BRD1, BRD2, BRD3 → 3 calls. 4 calls saved.
  //
  updateNode('brand', { status: 'running' });
  deactivateEdge('filter-brand');

  const uniqueBrandIds = [...new Set(filtered.map((item) => item.brand_id))];
  const brandCache = {};

  for (const brandId of uniqueBrandIds) {
    brandCache[brandId] = await mockFetchBrand(brandId, authResult.token);
    stats.totalApiCalls += 1;
    // Small delay between calls to make dedup visually legible
    await pause(200);
  }

  const dedupSaved = filtered.length - uniqueBrandIds.length;
  stats.dedupSaved += dedupSaved;

  // Carry-forward: Object.assign merges upstream fields + new brand fields.
  // Downstream node wins on key collision.
  const withBrands = filtered.map((item) =>
    Object.assign({}, item, brandCache[item.brand_id])
  );

  updateNode('brand', {
    status: 'done',
    output: withBrands,
    stats: {
      inputRows: filtered.length,
      outputRows: withBrands.length,
      apiCalls: uniqueBrandIds.length,
      dedupSaved,
    },
  });

  stampEdge('brand-csv', withBrands.length, `${withBrands.length} rows · 9 fields`);
  activateEdge('brand-csv');
  await pause(400);

  // ─── 5. CSV Inventory Join ────────────────────────────────────────────────
  //
  // Pure in-memory join — no API call, zero latency.
  //
  updateNode('csv', { status: 'running' });
  deactivateEdge('brand-csv');
  await pause(300);

  const withInventory = withBrands.map((item) =>
    Object.assign({}, item, csvLookupInventory(item.sku))
  );

  updateNode('csv', {
    status: 'done',
    output: withInventory,
    stats: { inputRows: withBrands.length, outputRows: withInventory.length, apiCalls: 0 },
  });

  stampEdge('csv-transform', withInventory.length, `${withInventory.length} rows · 12 fields`);
  activateEdge('csv-transform');
  await pause(400);

  // ─── 6. Transform ─────────────────────────────────────────────────────────
  updateNode('transform', { status: 'running' });
  deactivateEdge('csv-transform');
  await pause(300);

  const transformed = withInventory.map((item) =>
    Object.assign({}, item, {
      sale_price: Math.round(item.price * 0.85 * 100) / 100,
      display_name: `${item.brand_name}: ${item.name}`,
      in_stock: item.stock > 0,
      low_stock: item.stock > 0 && item.stock <= item.reorder_point,
    })
  );

  updateNode('transform', {
    status: 'done',
    output: transformed,
    stats: { inputRows: withInventory.length, outputRows: transformed.length },
  });

  stampEdge('transform-result', transformed.length, `${transformed.length} rows · 16 fields`);
  activateEdge('transform-result');
  await pause(400);

  // ─── 7. Result ────────────────────────────────────────────────────────────
  updateNode('result', { status: 'running' });
  deactivateEdge('transform-result');
  await pause(300);

  stats.finalRows = transformed.length;

  updateNode('result', {
    status: 'done',
    description: `${transformed.length} rows · ${Object.keys(transformed[0] ?? {}).length} fields`,
    output: transformed,
    stats: { outputRows: transformed.length },
  });

  return stats;
}
