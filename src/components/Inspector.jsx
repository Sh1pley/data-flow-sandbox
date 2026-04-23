import './Inspector.css';

const NODE_ROLE = {
  auth: {
    what: 'Singleton auth',
    detail: 'One token fetch per flow run. Shared by all three data source nodes. Not part of the collection or carry-forward chain.',
  },
  ds_products: {
    what: 'Data Source — single call',
    detail: 'One API call. Returns a raw envelope with a "products" array and meta fields. The Extract node downstream picks the array and defines the collection shape.',
  },
  ds_inventory: {
    what: 'Data Source — single call',
    detail: 'One API call. Returns a raw envelope with an "inventory" array and warehouse system meta. Completely independent of the Products call — runs on its own.',
  },
  ds_reviews: {
    what: 'Data Source — single call',
    detail: 'One API call. Returns a raw envelope with a "reviews" array and provider meta. Also independent — three total API calls in this entire flow.',
  },
  ex_products: {
    what: 'Extract — define collection shape',
    detail: 'Sets collection_path: "products". Picks the array from the raw response and selects only the fields this flow needs — sku, name, price. Outputs a typed collection of 5 items.',
  },
  ex_inventory: {
    what: 'Extract — define collection shape',
    detail: 'Sets collection_path: "inventory". Picks the inventory array and selects sku, stock, warehouse, reorder_point. Same 5 skus as Products — keyed identically for the join.',
  },
  ex_reviews: {
    what: 'Extract — define collection shape',
    detail: 'Sets collection_path: "reviews". Picks the reviews array and selects sku, rating, review_count, featured. Again the same 5 skus — all three collections share the sku key.',
  },
  preview: {
    what: 'Preview — three collections, one dataset',
    detail: 'Receives all three typed collections and joins them on sku via Object.assign. Each product row is enriched with its matching inventory and review data. Result: 5 rows with every field from every source — 9 fields total, assembled without any API being called more than once.',
  },
};

function formatValue(val) {
  if (val === null || val === undefined) return <span className="insp__null">null</span>;
  if (typeof val === 'boolean') return <span className="insp__bool">{String(val)}</span>;
  if (typeof val === 'number')  return <span className="insp__num">{val}</span>;
  const s = String(val);
  return s.length > 44 ? <span title={s}>{s.slice(0, 42)}…</span> : s;
}

function RawResponseView({ raw }) {
  if (!raw) return null;
  return (
    <div className="insp__raw">
      <div className="insp__raw-title">Raw API response</div>
      <div className="insp__raw-keys">
        {Object.entries(raw).map(([key, val]) => {
          const isArray = Array.isArray(val);
          const isObj   = !isArray && typeof val === 'object' && val !== null;
          const type    = isArray
            ? `Array(${val.length}) ← collection_path`
            : isObj ? `Object {${Object.keys(val).join(', ')}}` : JSON.stringify(val);
          return (
            <div key={key} className={`insp__raw-row ${isArray ? 'insp__raw-row--array' : ''}`}>
              <span className="insp__raw-key">{key}</span>
              <span className="insp__raw-type">{type}</span>
            </div>
          );
        })}
      </div>
      <div className="insp__raw-note">Extract node sets collection_path to pick the array.</div>
    </div>
  );
}

// Shows the three collections converging at Preview
function JoinDiagram({ nodeId, stats }) {
  const sources = [
    { id: 'ex_products',  label: 'Products',  fields: 'sku, name, price',                         color: '#6d28d9', count: 3 },
    { id: 'ex_inventory', label: 'Inventory', fields: 'sku, stock, warehouse, reorder_point',      color: '#6d28d9', count: 4 },
    { id: 'ex_reviews',   label: 'Reviews',   fields: 'sku, rating, review_count, featured',       color: '#6d28d9', count: 4 },
  ];
  return (
    <div className="join-diagram">
      <div className="join-diagram__title">Collection join — Object.assign on sku</div>
      {sources.map((s) => (
        <div key={s.id} className={`join-diagram__row ${s.id === nodeId ? 'join-diagram__row--active' : ''}`}>
          <span className="join-diagram__label" style={{ color: s.color }}>{s.label}</span>
          <div className="join-diagram__arrow">→</div>
          <span className="join-diagram__fields">{s.fields}</span>
        </div>
      ))}
      <div className="join-diagram__result">
        <span className="join-diagram__result-label">joined</span>
        <span className="join-diagram__result-val">
          {stats?.outputRows ?? '?'} rows · {stats?.fieldCount ?? '?'} fields
        </span>
      </div>
    </div>
  );
}

function NodeStory({ node }) {
  const { data } = node;
  const s    = data.stats ?? {};
  const role = NODE_ROLE[node.id];

  return (
    <div className="story">
      {role && (
        <div className="story__role">
          <span className="story__role-what">{role.what}</span>
          <p className="story__role-detail">{role.detail}</p>
        </div>
      )}

      {data.status === 'done' && (
        <div className="story__op">
          {node.id === 'auth' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">api calls</span><span className="story__fact-v">1</span></div>
              <div className="story__fact"><span className="story__fact-k">shared with</span><span className="story__fact-v">Products, Inventory, Reviews</span></div>
            </div>
          )}

          {node.data.nodeType === 'datasource' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">api calls</span><span className="story__fact-v">1</span></div>
              <div className="story__fact"><span className="story__fact-k">response keys</span><span className="story__fact-v story__fact-v--dim">{s.responseKeys}</span></div>
            </div>
          )}

          {node.data.nodeType === 'extract' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">collection_path</span><span className="story__fact-v story__fact-v--code">"{s.collectionPath}"</span></div>
              <div className="story__fact"><span className="story__fact-k">fields selected</span><span className="story__fact-v story__fact-v--dim">{s.fields}</span></div>
              <div className="story__fact"><span className="story__fact-k">rows out</span><span className="story__fact-v story__fact-v--blue">{s.outputRows}</span></div>
            </div>
          )}

          {node.id === 'preview' && (
            <div className="story__facts">
              <div className="story__fact"><span className="story__fact-k">sources joined</span><span className="story__fact-v">{s.sources}</span></div>
              <div className="story__fact"><span className="story__fact-k">join key</span><span className="story__fact-v story__fact-v--code">{s.joinKey}</span></div>
              <div className="story__fact"><span className="story__fact-k">rows</span><span className="story__fact-v story__fact-v--green">{s.outputRows}</span></div>
              <div className="story__fact story__fact--ruled"><span className="story__fact-k">fields per row</span><span className="story__fact-v story__fact-v--green">{s.fieldCount}</span></div>
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

export default function Inspector({ node }) {
  if (!node) {
    return (
      <div className="insp insp--empty">
        <div className="insp__empty-icon">👆</div>
        <div className="insp__hint">Click any node to inspect it.</div>
        <JoinDiagram nodeId={null} stats={null} />
      </div>
    );
  }

  const { data } = node;
  const rows    = data.output ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="insp">
      <div className="insp__name">{data.label}</div>

      <NodeStory node={node} />

      {/* Join diagram — always visible once any node is selected */}
      {data.status === 'done' && (
        <JoinDiagram nodeId={node.id} stats={data.stats} />
      )}

      {/* Raw response for Data Source nodes */}
      {data.nodeType === 'datasource' && data.rawResponse && (
        <RawResponseView raw={data.rawResponse} />
      )}

      {/* Data table */}
      {rows.length > 0 && (
        <>
          <div className="insp__table-header">
            <span className="insp__table-label">Output data</span>
            <span className="insp__table-count">{rows.length} rows · {columns.length} fields</span>
          </div>
          <div className="insp__scroll">
            <table className="insp__table">
              <thead>
                <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => <td key={col}>{formatValue(row[col])}</td>)}
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
