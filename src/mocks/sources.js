const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// 10 products across 3 brands — price filter (>= $75) leaves 7 rows, 3 unique brand_ids
export const PRODUCTS = [
  { sku: 'A001', name: 'Apex Runner Pro',    price: 129.99, brand_id: 'BRD1', category: 'Running' },
  { sku: 'A002', name: 'Apex Trail X',       price: 89.99,  brand_id: 'BRD1', category: 'Trail' },
  { sku: 'A003', name: 'Apex Lite',          price: 54.99,  brand_id: 'BRD1', category: 'Running' },
  { sku: 'B001', name: 'Bolt Sprint',        price: 149.99, brand_id: 'BRD2', category: 'Track' },
  { sku: 'B002', name: 'Bolt Cross',         price: 79.99,  brand_id: 'BRD2', category: 'Cross' },
  { sku: 'B003', name: 'Bolt Endure',        price: 119.99, brand_id: 'BRD2', category: 'Road' },
  { sku: 'C001', name: 'CoreStep Basic',     price: 44.99,  brand_id: 'BRD3', category: 'Casual' },
  { sku: 'C002', name: 'CoreStep Air',       price: 69.99,  brand_id: 'BRD3', category: 'Walking' },
  { sku: 'C003', name: 'CoreStep Pro',       price: 94.99,  brand_id: 'BRD3', category: 'Training' },
  { sku: 'C004', name: 'CoreStep Elite',     price: 164.99, brand_id: 'BRD3', category: 'Training' },
];

// Brand details — fetched by brand_id. 7 filtered rows → 3 unique brand_ids → 3 API calls (4 saved)
const BRANDS = {
  BRD1: { brand_name: 'Apex Athletics',   founded: 2008, country: 'USA', warranty_years: 2 },
  BRD2: { brand_name: 'Bolt Performance', founded: 2015, country: 'GBR', warranty_years: 1 },
  BRD3: { brand_name: 'CoreStep',         founded: 2001, country: 'USA', warranty_years: 3 },
};

// Inventory CSV — local tabular data, joined on sku. Zero API calls.
const INVENTORY = {
  A001: { stock: 234, warehouse: 'NYC', reorder_point: 50 },
  A002: { stock: 89,  warehouse: 'LAX', reorder_point: 25 },
  B001: { stock: 12,  warehouse: 'NYC', reorder_point: 20 },
  B002: { stock: 156, warehouse: 'CHI', reorder_point: 30 },
  B003: { stock: 67,  warehouse: 'LAX', reorder_point: 20 },
  C003: { stock: 91,  warehouse: 'CHI', reorder_point: 25 },
  C004: { stock: 38,  warehouse: 'LAX', reorder_point: 15 },
};

export async function mockFetchAuthToken() {
  await delay(900);
  return { token: 'Bearer eyJhbGciOiJIUzI1NiJ9.sandbox', expires_in: 3600 };
}

export async function mockFetchProducts(token) {
  await delay(700);
  if (!token) throw new Error('401 Unauthorized');
  return [...PRODUCTS];
}

export async function mockFetchBrand(brandId, token) {
  await delay(450);
  if (!token) throw new Error('401 Unauthorized');
  const brand = BRANDS[brandId];
  if (!brand) throw new Error(`404 Brand not found: ${brandId}`);
  return { brand_id: brandId, ...brand };
}

export function csvLookupInventory(sku) {
  // Synchronous — no API call, pure in-memory join
  return INVENTORY[sku] ?? { stock: 0, warehouse: 'UNKNOWN', reorder_point: 10 };
}
