const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const MOCK_AUTH = {
  token: 'Bearer eyJhbGciOiJIUzI1NiJ9.sandbox',
  expires_in: 3600,
};

export const MOCK_PRODUCTS = {
  meta: { total: 5, page: 1, request_id: 'req_prod_a1b2' },
  products: [
    { sku: 'A001', name: 'Apex Runner Pro', price: 129.99 },
    { sku: 'A002', name: 'Apex Trail X',    price: 89.99  },
    { sku: 'B001', name: 'Bolt Sprint',     price: 149.99 },
    { sku: 'B002', name: 'Bolt Cross',      price: 79.99  },
    { sku: 'C001', name: 'CoreStep Pro',    price: 94.99  },
  ],
};

export const MOCK_INVENTORY = {
  meta: { warehouse_system: 'WMS-v3', request_id: 'req_inv_c3d4' },
  inventory: [
    { sku: 'A001', stock: 234, warehouse: 'NYC', reorder_point: 50 },
    { sku: 'A002', stock: 89,  warehouse: 'LAX', reorder_point: 25 },
    { sku: 'B001', stock: 12,  warehouse: 'NYC', reorder_point: 20 },
    { sku: 'B002', stock: 156, warehouse: 'CHI', reorder_point: 30 },
    { sku: 'C001', stock: 91,  warehouse: 'CHI', reorder_point: 25 },
  ],
};

export const MOCK_REVIEWS = {
  meta: { provider: 'ReviewsAPI', request_id: 'req_rev_e5f6' },
  reviews: [
    { sku: 'A001', rating: 4.7, review_count: 234, featured: 'Best running shoe.'   },
    { sku: 'A002', rating: 4.4, review_count: 89,  featured: 'Great on trails.'     },
    { sku: 'B001', rating: 4.9, review_count: 312, featured: 'Fastest on track.'    },
    { sku: 'B002', rating: 4.1, review_count: 43,  featured: 'Solid cross-trainer.' },
    { sku: 'C001', rating: 4.3, review_count: 67,  featured: 'All day comfort.'     },
  ],
};

export async function mockFetchAuthToken() {
  await delay(800);
  return { token: 'Bearer eyJhbGciOiJIUzI1NiJ9.sandbox', expires_in: 3600 };
}

// ── API 1: Products ───────────────────────────────────────────────────────
// One call. Returns product catalog. Extract picks collection_path "products".
export async function mockFetchProducts(token) {
  await delay(650);
  if (!token) throw new Error('401 Unauthorized');
  return {
    meta: { total: 5, page: 1, request_id: 'req_prod_a1b2' },
    products: [
      { sku: 'A001', name: 'Apex Runner Pro',  price: 129.99 },
      { sku: 'A002', name: 'Apex Trail X',     price: 89.99  },
      { sku: 'B001', name: 'Bolt Sprint',      price: 149.99 },
      { sku: 'B002', name: 'Bolt Cross',       price: 79.99  },
      { sku: 'C001', name: 'CoreStep Pro',     price: 94.99  },
    ],
  };
}

// ── API 2: Inventory ──────────────────────────────────────────────────────
// One call. Returns stock levels. Extract picks collection_path "inventory".
export async function mockFetchInventory(token) {
  await delay(500);
  if (!token) throw new Error('401 Unauthorized');
  return {
    meta: { warehouse_system: 'WMS-v3', request_id: 'req_inv_c3d4' },
    inventory: [
      { sku: 'A001', stock: 234, warehouse: 'NYC', reorder_point: 50  },
      { sku: 'A002', stock: 89,  warehouse: 'LAX', reorder_point: 25  },
      { sku: 'B001', stock: 12,  warehouse: 'NYC', reorder_point: 20  },
      { sku: 'B002', stock: 156, warehouse: 'CHI', reorder_point: 30  },
      { sku: 'C001', stock: 91,  warehouse: 'CHI', reorder_point: 25  },
    ],
  };
}

// ── API 3: Reviews ────────────────────────────────────────────────────────
// One call. Returns aggregated review data. Extract picks collection_path "reviews".
export async function mockFetchReviews(token) {
  await delay(580);
  if (!token) throw new Error('401 Unauthorized');
  return {
    meta: { provider: 'ReviewsAPI', request_id: 'req_rev_e5f6' },
    reviews: [
      { sku: 'A001', rating: 4.7, review_count: 234, featured: 'Best running shoe.'   },
      { sku: 'A002', rating: 4.4, review_count: 89,  featured: 'Great on trails.'     },
      { sku: 'B001', rating: 4.9, review_count: 312, featured: 'Fastest on track.'    },
      { sku: 'B002', rating: 4.1, review_count: 43,  featured: 'Solid cross-trainer.' },
      { sku: 'C001', rating: 4.3, review_count: 67,  featured: 'All day comfort.'     },
    ],
  };
}
