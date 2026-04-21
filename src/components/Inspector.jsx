import './Inspector.css';

// Visual identity for each pipeline stage
const NODE_META = {
  auth:      { label: 'OAuth Token',   color: '#7c3aed', short: 'Auth'     },
  products:  { label: 'Products API',  color: '#2563eb', short: 'Products' },
  brand:     { label: 'Brand Details', color: '#818cf8', short: 'Brand'    },
  csv:       { label: 'Inventory CSV', color: '#16a34a', short: 'CSV'      },
  transform: { label: 'Transform',     color: '#0891b2', short: 'Transform' },
};

// Which pipeline node introduced each field
const FIELD_ORIGIN = {
  token:          'auth',      expires_in:     'auth',
  sku:            'products',  name:           'products',
  price:          'products',  brand_id:       'products',  category:       'products',
  brand_name:     'brand',     founded:        'brand',
  country:        'brand',     warranty_years: 'brand',
  stock:          'csv',       warehouse:      'csv',       reorder_point:  'csv',
  sale_price:     'transform', display_name:   'transform',
  in_stock:       'transform', low_stock:      'transform',
};

// The Object.assign chain the executor runs to produce each final row
const BUILD_STAGES = [
  { nodeId: 'products', label: 'Products API',  fields: ['sku', 'name', 'price', 'brand_id', 'category'] },
  { nodeId: 'brand',    label: 'Brand Details', fields: ['brand_name', 'founded', 'country', 'warranty_years'] },
  { nodeId: 'csv',      label: 'Inventory CSV', fields: ['stock', 'warehouse', 'reorder_point'] },
  { nodeId: 'transform',label: 'Transform',     fields: ['sale_price', 'display_name', 'in_stock', 'low_stock'] },
];

function fieldColor(col) {
  const origin = FIELD_ORIGIN[col];
  return origin ? (NODE_META[origin]?.color ?? '#64748b') : '#64748b';
}

function formatValue(val) {
  if (val === null || val === undefined) return <span className="insp__null">null</span>;
  if (typeof val === 'boolean')  return <span className="insp__bool">{String(val)}</span>;
  if (typeof val === 'number')   return <span className="insp__num">{val}</span>;
  const s = String(val);
  return s.length > 42 ? <span title={s}>{s.slice(0, 40)}…</span> : s;
}

// Which distinct nodes contributed fields to this row's columns
function originsFor(columns) {
  const seen = [];
  const ids = new Set();
  for (const col of columns) {
    const id = FIELD_ORIGIN[col];
    if (id && !ids.has(id)) { ids.add(id); seen.push(id); }
  }
  return seen;
}

// ── Result node: Object.assign build-up visualization ─────────────────────

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
              <div
                className="insp__assign-source-bar"
                style={{ background: meta.color }}
              />
              <div className="insp__assign-stage-inner">
                <div className="insp__assign-node-label" style={{ color: meta.color }}>
                  ← {label}
                </div>
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
          <span className="insp__comment"> // → {Object.keys(sample).length} total fields per row</span>
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
        <div className="insp__hint">Click any node to inspect its output</div>
        <div className="insp__hint-sub">
          The Result node shows how every field was assembled via carry-forward
        </div>
      </div>
    );
  }

  const { data } = node;
  const rows = data.output ?? [];

  if (rows.length === 0) {
    return (
      <div className="insp">
        <div className="insp__name">{data.label}</div>
        <div className="insp__hint">
          {data.status === 'idle' ? 'Not yet executed — click Run Flow.' : 'No output rows.'}
        </div>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);
  const origins = originsFor(columns);

  return (
    <div className="insp">
      {/* Header */}
      <div className="insp__name">{data.label}</div>

      {/* Quick stats */}
      {data.stats && (
        <div className="insp__meta">
          <span className="insp__meta-chip">{rows.length} rows</span>
          <span className="insp__meta-chip">{columns.length} fields</span>
          {data.stats.apiCalls !== undefined && (
            <span className={`insp__meta-chip ${data.stats.apiCalls === 0 ? 'insp__meta-chip--green' : ''}`}>
              {data.stats.apiCalls === 0 ? '0 API calls (in-memory)' : `${data.stats.apiCalls} API call${data.stats.apiCalls !== 1 ? 's' : ''}`}
            </span>
          )}
          {data.stats.dedupSaved > 0 && (
            <span className="insp__meta-chip insp__meta-chip--green">
              ↓ {data.stats.dedupSaved} calls saved (dedup)
            </span>
          )}
        </div>
      )}

      {/* Field origins legend */}
      {origins.length > 0 && (
        <div className="insp__origins">
          <span className="insp__origins-label">Field sources:</span>
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

      {/* Result node: Object.assign carry-forward visualization */}
      {node.id === 'result' && rows.length > 0 && (
        <BuildupPanel rows={rows} />
      )}

      {/* Data table */}
      <div className="insp__scroll">
        <table className="insp__table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    color: fieldColor(col),
                    borderBottom: `2px solid ${fieldColor(col)}`,
                  }}
                >
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
                  const color  = origin ? NODE_META[origin]?.color : null;
                  return (
                    <td
                      key={col}
                      style={color ? {
                        background: `color-mix(in srgb, ${color} 6%, transparent)`,
                      } : undefined}
                    >
                      {formatValue(row[col])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
