import {
  mockFetchAuthToken,
  mockFetchProducts,
  mockFetchInventory,
  mockFetchReviews,
} from '../mocks/sources.js';

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
 * Three independent API calls — no fan-out.
 * Each API returns its own collection. Each Extract node defines the schema.
 * The Preview node joins all three collections on sku via Object.assign,
 * producing one unified dataset.
 *
 * Products API  → 1 call → Extract → [{sku, name, price}]
 * Inventory API → 1 call → Extract → [{sku, stock, warehouse, reorder_point}]
 * Reviews API   → 1 call → Extract → [{sku, rating, review_count, featured}]
 *                                         ↓
 *                              Preview: join on sku
 *                              [{sku, name, price, stock, warehouse, reorder_point, rating, review_count, featured}]
 */
export async function runFlow(updateNode, updateEdge) {
  const stats = { totalApiCalls: 0, finalRows: 0, finalFields: 0 };

  // ─── 1. Auth ──────────────────────────────────────────────────────────────
  updateNode('auth', { status: 'running' });
  await pause(200);
  const { token } = await mockFetchAuthToken();
  stats.totalApiCalls += 1;
  updateNode('auth', {
    status: 'done',
    output: [{ token: token.slice(0, 30) + '…', expires_in: 3600 }],
    stats: { apiCalls: 1 },
  });
  stampEdge(updateEdge, 'auth-ds_products',  'auth token', '#7c3aed');
  stampEdge(updateEdge, 'auth-ds_inventory', 'auth token', '#7c3aed');
  stampEdge(updateEdge, 'auth-ds_reviews',   'auth token', '#7c3aed');
  glow(updateEdge, 'auth-ds_products',  '#7c3aed');
  glow(updateEdge, 'auth-ds_inventory', '#7c3aed');
  glow(updateEdge, 'auth-ds_reviews',   '#7c3aed');
  await pause(600);

  // ─── 2. Products API + Extract ────────────────────────────────────────────
  updateNode('ds_products', { status: 'running' });
  const rawProducts = await mockFetchProducts(token);
  stats.totalApiCalls += 1;
  updateNode('ds_products', {
    status: 'done', rawResponse: rawProducts, output: null,
    stats: { apiCalls: 1, responseKeys: Object.keys(rawProducts).join(', ') },
  });
  stampEdge(updateEdge, 'auth-ds_products', 'auth token', '#7c3aed');
  stampEdge(updateEdge, 'ds_products-ex_products', 'raw response');
  glow(updateEdge, 'ds_products-ex_products');
  await pause(400);

  updateNode('ex_products', { status: 'running' });
  await pause(300);
  const productsCollection = rawProducts.products.map(({ sku, name, price }) =>
    ({ sku, name, price })
  );
  updateNode('ex_products', {
    status: 'done', output: productsCollection,
    stats: { collectionPath: 'products', outputRows: productsCollection.length, fields: 'sku, name, price' },
  });
  stampEdge(updateEdge, 'ds_products-ex_products', 'raw response');
  stampEdge(updateEdge, 'ex_products-preview', `${productsCollection.length} rows · 3 fields`);
  glow(updateEdge, 'ex_products-preview');
  await pause(500);

  // ─── 3. Inventory API + Extract ───────────────────────────────────────────
  updateNode('ds_inventory', { status: 'running' });
  const rawInventory = await mockFetchInventory(token);
  stats.totalApiCalls += 1;
  updateNode('ds_inventory', {
    status: 'done', rawResponse: rawInventory, output: null,
    stats: { apiCalls: 1, responseKeys: Object.keys(rawInventory).join(', ') },
  });
  stampEdge(updateEdge, 'auth-ds_inventory', 'auth token', '#7c3aed');
  stampEdge(updateEdge, 'ds_inventory-ex_inventory', 'raw response');
  glow(updateEdge, 'ds_inventory-ex_inventory');
  await pause(400);

  updateNode('ex_inventory', { status: 'running' });
  await pause(300);
  const inventoryCollection = rawInventory.inventory.map(({ sku, stock, warehouse, reorder_point }) =>
    ({ sku, stock, warehouse, reorder_point })
  );
  updateNode('ex_inventory', {
    status: 'done', output: inventoryCollection,
    stats: { collectionPath: 'inventory', outputRows: inventoryCollection.length, fields: 'sku, stock, warehouse, reorder_point' },
  });
  stampEdge(updateEdge, 'ds_inventory-ex_inventory', 'raw response');
  stampEdge(updateEdge, 'ex_inventory-preview', `${inventoryCollection.length} rows · 4 fields`);
  glow(updateEdge, 'ex_inventory-preview');
  await pause(500);

  // ─── 4. Reviews API + Extract ─────────────────────────────────────────────
  updateNode('ds_reviews', { status: 'running' });
  const rawReviews = await mockFetchReviews(token);
  stats.totalApiCalls += 1;
  updateNode('ds_reviews', {
    status: 'done', rawResponse: rawReviews, output: null,
    stats: { apiCalls: 1, responseKeys: Object.keys(rawReviews).join(', ') },
  });
  stampEdge(updateEdge, 'auth-ds_reviews', 'auth token', '#7c3aed');
  stampEdge(updateEdge, 'ds_reviews-ex_reviews', 'raw response');
  glow(updateEdge, 'ds_reviews-ex_reviews');
  await pause(400);

  updateNode('ex_reviews', { status: 'running' });
  await pause(300);
  const reviewsCollection = rawReviews.reviews.map(({ sku, rating, review_count, featured }) =>
    ({ sku, rating, review_count, featured })
  );
  updateNode('ex_reviews', {
    status: 'done', output: reviewsCollection,
    stats: { collectionPath: 'reviews', outputRows: reviewsCollection.length, fields: 'sku, rating, review_count, featured' },
  });
  stampEdge(updateEdge, 'ds_reviews-ex_reviews', 'raw response');
  stampEdge(updateEdge, 'ex_reviews-preview', `${reviewsCollection.length} rows · 4 fields`);
  glow(updateEdge, 'ex_reviews-preview');
  await pause(500);

  // ─── 5. Preview — join all three collections on sku ───────────────────────
  //
  // Three independent collections, each with the same set of sku keys.
  // Object.assign carry-forward merges them into one unified row per sku.
  // No fan-out — each API was called exactly once.
  //
  updateNode('preview', { status: 'running' });
  await pause(400);

  const inventoryBySku = Object.fromEntries(inventoryCollection.map((i) => [i.sku, i]));
  const reviewsBySku   = Object.fromEntries(reviewsCollection.map((r) => [r.sku, r]));

  const joined = productsCollection.map((product) =>
    Object.assign(
      {},
      product,
      inventoryBySku[product.sku] ?? {},
      reviewsBySku[product.sku]   ?? {},
    )
  );

  stats.finalRows   = joined.length;
  stats.finalFields = joined.length > 0 ? Object.keys(joined[0]).length : 0;

  updateNode('preview', {
    status: 'done',
    description: `${stats.finalRows} rows · ${stats.finalFields} fields`,
    output: joined,
    stats: {
      outputRows:   stats.finalRows,
      fieldCount:   stats.finalFields,
      sources:      3,
      joinKey:      'sku',
    },
  });

  return stats;
}
