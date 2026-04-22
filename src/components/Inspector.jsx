import './Inspector.css';

// ── Field origin metadata ──────────────────────────────────────────────────

const NODE_META = {
  auth:     { label: 'OAuth Token',   color: '#7c3aed', short: 'Auth'     },
  products: { label: 'Products API',  color: '#2563eb', short: 'Products' },
  csv:      { label: 'Inventory CSV', color: '#16a34a', short: 'CSV'      },
  branch:   { label: 'Branch Path',   color: '#f59e0b', short: 'Branch'   },
};

const FIELD_ORIGIN = {
  token:         'auth',     expires_in:    'auth',
  sku:           'products', name:          'products',
  price:         'products', brand_id:      'products', category:      'products',
  stock:         'csv',      warehouse:     'csv',      reorder_point: 'csv',
  badge:         'branch',   display_price: 'branch',
  campaign_tag:  'branch',   urgent:        'branch',
};

const BUILD_STAGES = [
  { nodeId: 'products', label: 'Products API',  fields: ['sku', 'name', 'price', 'brand_id', 'category'] },
  { nodeId: 'csv',      label: 'Inventory CSV', fields: ['stock', 'warehouse', 'reorder_point'] },
  { nodeId: 'branch',   label: 'Branch Path',   fields: ['badge', 'display_price', 'campaign_tag', 'urgent'] },
];

// ── Per-node role descriptions ─────────────────────────────────────────────

const NODE_ROLE = {
  auth: {
    what: 'Singleton auth',
    detail: 'Fetches a bearer token once per flow run. Shared across every API node via $auth_token in Global Scope. Never repeated per row — no matter how many rows flow downstream.',
  },
  products: {
    what: 'Base collection origin',
    detail: 'Makes a single API call and returns the full row set. Every object that flows through the rest of the pipeline starts here. Fields from this node are carry-forwarded through every downstream node automatically.',
  },
  filter: {
    what: 'Cardinality reduction',
    detail: 'Evaluates each row against a condition. Rows that pass continue downstream unchanged. Rows that fail are dropped. Nothing is added — only subtracted. Filtering before any fan-out node keeps downstream API calls minimal.',
  },
  csv: {
    what: 'Zero-cost enrichment',
    detail: 'Joins each row with a local lookup table using a shared key. No API call — purely in-memory. Fields from the CSV are merged into each row via carry-forward, making them available to every downstream node.',
  },
  branch: {
    what: 'Conditional split',
    detail: 'Evaluates each row against a condition and routes it to exactly one path. Every row that enters exits through either Path A or Path B — none are created, none are lost. The Merge node downstream verifies this.',
  },
  pathA: {
    what: 'Path A transform',
    detail: 'Adds path-specific fields to rows routed here by the Branch. These fields do not exist on Path B rows — the two paths produce objects with different shapes, which is fine. The Merge node reunites them into one collection.',
  },
  pathB: {
    what: 'Path B transform',
    detail: 'Adds path-specific fields to rows routed here by the Branch. These rows get urgency-specific values (discounted price, campaign badge) that are meaningless for Path A rows — and that\'s intentional.',
  },
  merge: {
    what: 'Lossless recombination',
    detail: 'Collects rows from both paths back into one collection. Path A rows + Path B rows must equal what entered the Branch. The ✓ proves no data was created or destroyed — branching is safe.',
  },
  result: {
    what: 'Final data package',
    detail: 'The assembled collection ready for use by tactics and Designer. Every row contains all fields accumulated through carry-forward across every node — 12 fields built up across 4 pipeline stages via Object.assign.',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatValue(val) {
  if (val === null || val === undefined) return <span className="insp__null">null</span>;
  if (typeof val === 'boolean')  return <span className="insp__bool">{String(val)}</span>;
  if (typeof val === 'number')   return <span className="insp__num">{val}</span>;
  const s = String(val);
  return s.length > 42 ? <span title={s}>{s.slice(0, 40)}…</span> : s;
}

function fieldColor(col) {
  const origin = FIELD_ORIGIN[col];
  return origin ? (NODE_META[origin]?.color ?? '#64748b') : '#64748b';
}

function originsFor(columns) {
  const seen = [], ids = new Set();
  for (const col of columns) {
    const id = FIELD_ORIGIN[col];
    if (id && !ids.has(id)) { ids.add(id); seen.push(id); }
  }
  return seen;
}

// ── Node story card ────────────────────────────────────────────────────────

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="story__bar-wrap">
      <div className="story__bar">
        <div className="story__bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="story__bar-label">{pct}%</span>
    </div>
  );
}

function SplitBar({ a, b }) {
  const total = a + b;
  const pctA = total > 0 ? Math.round((a / total) * 100) : 50;
  return (
    <div className="story__split-bar">
      <div className="story__split-a" style={{ width: `${pctA}%` }}>
        <span>A: {a}</span>
      </div>
      <div className="story__split-b" style={{ width: `${100 - pctA}%` }}>
        <span>B: {b}</span>
      </div>
    </div>
  );
}

function NodeStory({ node }) {
  const { data } = node;
  const s = data.stats ?? {};
  const role = NODE_ROLE[node.id] ?? NODE_ROLE[data.nodeType] ?? null;
  const rows = data.output ?? [];
  const firstRow = rows[0] ?? {};

  return (
    <div className="story">
      {/* Role header */}
      {role && (
        <div className="story__role">
          <span className="story__role-what">{role.what}</span>
          <p className="story__role-detail">{role.detail}</p>
        </div>
      )}

      {/* Operation-specific visual */}
      {data.status === 'done' && (
        <div className="story__op">

          {/* Auth */}
          {data.nodeType === 'auth' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">runs</span><span className="story__fact-v">once per flow</span></div>
              <div className="story__fact"><span className="story__fact-k">promotes</span><span className="story__fact-v story__fact-v--amber">$auth_token → Global Scope</span></div>
            </div>
          )}

          {/* API source */}
          {data.nodeType === 'api' && node.id === 'products' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">api calls</span><span className="story__fact-v">{s.apiCalls ?? 1}</span></div>
              <div className="story__fact"><span className="story__fact-k">rows returned</span><span className="story__fact-v story__fact-v--blue">{s.outputRows}</span></div>
              <div className="story__fact"><span className="story__fact-k">fields per row</span><span className="story__fact-v">{Object.keys(firstRow).length}</span></div>
              <div className="story__fact"><span className="story__fact-k">promotes</span><span className="story__fact-v story__fact-v--amber">$max_price → Global Scope</span></div>
            </div>
          )}

          {/* Filter */}
          {data.nodeType === 'filter' && s.inputRows !== undefined && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">condition</span><span className="story__fact-v story__fact-v--code">price ≥ $75</span></div>
              <div className="story__fact"><span className="story__fact-k">rows in</span><span className="story__fact-v">{s.inputRows}</span></div>
              <div className="story__fact"><span className="story__fact-k">rows passed</span><span className="story__fact-v story__fact-v--blue">{s.outputRows}</span></div>
              <div className="story__fact"><span className="story__fact-k">rows dropped</span><span className="story__fact-v story__fact-v--dim">{s.inputRows - s.outputRows}</span></div>
              <ProgressBar value={s.outputRows} max={s.inputRows} color="#d97706" />
            </div>
          )}

          {/* CSV join */}
          {data.nodeType === 'csv' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">join key</span><span className="story__fact-v story__fact-v--code">sku</span></div>
              <div className="story__fact"><span className="story__fact-k">api calls</span><span className="story__fact-v story__fact-v--green">0</span></div>
              <div className="story__fact"><span className="story__fact-k">rows enriched</span><span className="story__fact-v story__fact-v--blue">{s.outputRows}</span></div>
              <div className="story__fact"><span className="story__fact-k">fields added</span><span className="story__fact-v story__fact-v--green">stock, warehouse, reorder_point</span></div>
            </div>
          )}

          {/* Branch */}
          {data.nodeType === 'branch' && s.pathARows !== undefined && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">condition</span><span className="story__fact-v story__fact-v--code">stock ≥ $stock_threshold</span></div>
              <div className="story__fact"><span className="story__fact-k">reads global</span><span className="story__fact-v story__fact-v--amber">$stock_threshold = 75</span></div>
              <div className="story__fact"><span className="story__fact-k">rows in</span><span className="story__fact-v">{s.inputRows}</span></div>
              <SplitBar a={s.pathARows} b={s.pathBRows} />
              <div className="story__split-labels">
                <span className="story__split-label-a">A: {s.pathARows} rows (premium)</span>
                <span className="story__split-label-b">B: {s.pathBRows} rows (urgency)</span>
              </div>
            </div>
          )}

          {/* Transform paths */}
          {data.nodeType === 'transform' && node.id === 'pathA' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">rows in</span><span className="story__fact-v">{s.inputRows}</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">badge</span><span className="story__fact-v story__fact-v--code">"In Stock"</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">display_price</span><span className="story__fact-v story__fact-v--code">= price (full)</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">campaign_tag</span><span className="story__fact-v story__fact-v--code">"premium"</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">urgent</span><span className="story__fact-v story__fact-v--code">false</span></div>
            </div>
          )}

          {data.nodeType === 'transform' && node.id === 'pathB' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">rows in</span><span className="story__fact-v">{s.inputRows}</span></div>
              <div className="story__fact"><span className="story__fact-k">reads global</span><span className="story__fact-v story__fact-v--amber">$campaign_name = "Spring Sale"</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">badge</span><span className="story__fact-v story__fact-v--code">"[Spring Sale] Only N left!"</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">display_price</span><span className="story__fact-v story__fact-v--code">= price × 0.9</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">campaign_tag</span><span className="story__fact-v story__fact-v--code">"clearance"</span></div>
              <div className="story__fact story__fact--added"><span className="story__fact-k">urgent</span><span className="story__fact-v story__fact-v--code">true</span></div>
            </div>
          )}

          {/* Merge */}
          {data.nodeType === 'merge' && s.pathARows !== undefined && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k story__fact-k--green">from path A</span><span className="story__fact-v story__fact-v--green">+{s.pathARows} rows</span></div>
              <div className="story__fact"><span className="story__fact-k story__fact-k--amber">from path B</span><span className="story__fact-v story__fact-v--amber">+{s.pathBRows} rows</span></div>
              <div className="story__fact story__fact--total">
                <span className="story__fact-k">total out</span>
                <span className="story__fact-v story__fact-v--blue">{s.outputRows} ✓ ({s.pathARows} + {s.pathBRows} = {s.outputRows})</span>
              </div>
            </div>
          )}

          {/* Result */}
          {data.nodeType === 'result' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">final rows</span><span className="story__fact-v story__fact-v--blue">{s.outputRows}</span></div>
              <div className="story__fact"><span className="story__fact-k">fields per row</span><span className="story__fact-v story__fact-v--blue">{Object.keys(firstRow).length}</span></div>
              <div className="story__fact"><span className="story__fact-k">pipeline stages</span><span className="story__fact-v">4 (auth, products, csv, branch paths)</span></div>
            </div>
          )}
        </div>
      )}

      {data.status === 'idle' && (
        <div className="story__waiting">Run the flow to see this node's operation.</div>
      )}
    </div>
  );
}

// ── Object.assign buildup (result node only) ───────────────────────────────

function BuildupPanel({ rows }) {
  const sample = rows?.[0] ?? {};
  return (
    <div className="insp__buildup">
      <div className="insp__buildup-title">
        How each row is assembled — carry-forward via <code>Object.assign</code>
      </div>
      <div className="insp__assign-block">
        <div className="insp__assign-line insp__assign-line--fn">
          <span className="insp__kw">Object.assign</span>
          <span className="insp__punct">( &#123;&#125;,</span>
        </div>
        {BUILD_STAGES.map(({ nodeId, label, fields }, i) => {
          const meta = NODE_META[nodeId];
          const isLast = i === BUILD_STAGES.length - 1;
          return (
            <div key={nodeId} className="insp__assign-stage">
              <div className="insp__assign-source-bar" style={{ background: meta.color }} />
              <div className="insp__assign-stage-inner">
                <div className="insp__assign-node-label" style={{ color: meta.color }}>← {label}</div>
                <div className="insp__assign-fields">
                  <span className="insp__punct">&#123; </span>
                  {fields.map((f, fi) => (
                    <span key={f}>
                      <span className="insp__field-name">{f}</span>
                      <span className="insp__colon">: </span>
                      <span className="insp__field-val">{formatValue(sample[f])}</span>
                      {fi < fields.length - 1 && <span className="insp__punct">, </span>}
                    </span>
                  ))}
                  <span className="insp__punct"> &#125;{isLast ? '' : ','}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="insp__assign-line">
          <span className="insp__punct">)</span>
          <span className="insp__comment"> // → {Object.keys(sample).length} fields per row</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Inspector ─────────────────────────────────────────────────────────

export default function Inspector({ node }) {
  if (!node) {
    return (
      <div className="insp insp--empty">
        <div className="insp__empty-icon">👆</div>
        <div className="insp__hint">Click any node to see what it does and what it produces</div>
      </div>
    );
  }

  const { data } = node;
  const rows = data.output ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const origins = originsFor(columns);

  return (
    <div className="insp">
      {/* Node name */}
      <div className="insp__name">{data.label}</div>

      {/* What this node does + operation stats */}
      <NodeStory node={node} />

      {/* Result node: Object.assign carry-forward breakdown */}
      {node.id === 'result' && rows.length > 0 && (
        <BuildupPanel rows={rows} />
      )}

      {/* Data table — scrollable */}
      {rows.length > 0 && (
        <>
          <div className="insp__table-header">
            <span className="insp__table-label">Output data</span>
            <span className="insp__table-count">{rows.length} rows · {columns.length} fields</span>
            {origins.length > 0 && (
              <div className="insp__origins">
                {origins.map((nodeId) => {
                  const m = NODE_META[nodeId];
                  return (
                    <span key={nodeId} className="insp__origin-chip" style={{ '--oc': m.color }}>
                      <span className="insp__origin-dot" />
                      {m.short}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="insp__scroll">
            <table className="insp__table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col} style={{ color: fieldColor(col), borderBottom: `2px solid ${fieldColor(col)}` }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => {
                      const origin = FIELD_ORIGIN[col];
                      const color = origin ? NODE_META[origin]?.color : null;
                      return (
                        <td key={col} style={color ? { background: `color-mix(in srgb, ${color} 6%, transparent)` } : undefined}>
                          {formatValue(row[col])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
