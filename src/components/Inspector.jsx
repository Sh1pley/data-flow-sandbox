import './Inspector.css';

// ─── Node role descriptions ────────────────────────────────────────────────

const NODE_ROLE = {
  auth_api: {
    what: 'Data Source — auth getter',
    detail: 'Fetches the auth token endpoint. Returns a raw envelope. The Extract node downstream selects "token" and coerces it into a single-item collection.',
  },
  auth_ex: {
    what: 'Extract — scalar to collection',
    detail: 'Selects "token" from the auth response and wraps it as [{token: "Bearer..."}]. This single-item collection flows to each downstream datasource.',
  },
  ds_products:  { what: 'Data Source — single call', detail: 'Receives the token collection, authenticates, then fetches the Products API. Returns a raw envelope for Extract to process.' },
  ds_inventory: { what: 'Data Source — single call', detail: 'Receives the token collection, authenticates, then fetches the Inventory API. Returns a raw envelope for Extract to process.' },
  ds_reviews:   { what: 'Data Source — single call', detail: 'Receives the token collection, authenticates, then fetches the Reviews API. Returns a raw envelope for Extract to process.' },
  ex_products:  { what: 'Extract — collection selector', detail: 'Select a collection path from the upstream raw response. All fields from each item are forwarded downstream.' },
  ex_inventory: { what: 'Extract — collection selector', detail: 'Select a collection path from the upstream raw response. All fields from each item are forwarded downstream.' },
  ex_reviews:   { what: 'Extract — collection selector', detail: 'Select a collection path from the upstream raw response. All fields from each item are forwarded downstream.' },
  exit: {
    what: 'Exit — join and output',
    detail: 'Receives collections from each upstream Extract. Joins them on the configured key using Object.assign per matched item. The unified collection is the flow output.',
  },
};

// ─── Formatting ───────────────────────────────────────────────────────────

function formatValue(val) {
  if (val === null || val === undefined) return <span className="insp__null">null</span>;
  if (typeof val === 'boolean') return <span className="insp__bool">{String(val)}</span>;
  if (typeof val === 'number')  return <span className="insp__num">{val}</span>;
  const s = String(val);
  return s.length > 44 ? <span title={s}>{s.slice(0, 42)}…</span> : s;
}

// ─── Sub-components ───────────────────────────────────────────────────────

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
            ? `Array(${val.length}) — selectable`
            : isObj ? `Object {${Object.keys(val).join(', ')}}` : JSON.stringify(val);
          return (
            <div key={key} className={`insp__raw-row ${isArray ? 'insp__raw-row--collection' : ''}`}>
              <span className="insp__raw-key">{key}</span>
              <span className="insp__raw-type">{type}</span>
            </div>
          );
        })}
      </div>
      <div className="insp__raw-note">Extract node selects a path to coerce into a collection.</div>
    </div>
  );
}

function ExitDiagram({ stats }) {
  return (
    <div className="join-diagram">
      <div className="join-diagram__title">
        Join on{' '}
        <code style={{ fontFamily: 'SF Mono, monospace', color: '#a78bfa', fontSize: 11 }}>
          "{stats?.joinKey}"
        </code>
      </div>
      {['Products', 'Inventory', 'Reviews'].map((label) => (
        <div key={label} className="join-diagram__row join-diagram__row--active">
          <span className="join-diagram__label" style={{ color: '#6d28d9' }}>{label}</span>
          <div className="join-diagram__arrow">→</div>
          <span className="join-diagram__fields">all fields</span>
        </div>
      ))}
      <div className="join-diagram__result">
        <span className="join-diagram__result-label">output</span>
        <span className="join-diagram__result-val">
          {stats?.outputRows ?? '?'} rows · {stats?.fieldCount ?? '?'} fields
        </span>
      </div>
    </div>
  );
}

// ─── Config editors ───────────────────────────────────────────────────────

function DatasourceConfigEditor({ node, running, onConfigChange }) {
  const config = node.data.config ?? {};
  const mode   = config.mode ?? 'paste';
  const set    = (patch) => onConfigChange(node.id, { ...config, ...patch });

  return (
    <div className="insp__editor">
      <div className="insp__editor-label">Response source</div>
      <div className="insp__mode-toggle">
        <button
          className={`insp__mode-btn ${mode === 'paste' ? 'insp__mode-btn--active' : ''}`}
          onClick={() => set({ mode: 'paste' })}
          disabled={running}
        >
          Paste JSON
        </button>
        <button
          className={`insp__mode-btn ${mode === 'fetch' ? 'insp__mode-btn--active' : ''}`}
          onClick={() => set({ mode: 'fetch' })}
          disabled={running}
        >
          Fetch URL
        </button>
      </div>

      {mode === 'paste' && (
        <textarea
          className="insp__paste"
          value={config.pasteJson ?? ''}
          onChange={(e) => set({ pasteJson: e.target.value })}
          disabled={running}
          placeholder='Paste JSON response here…&#10;{"key": "value"}'
          rows={8}
          spellCheck={false}
        />
      )}

      {mode === 'fetch' && (
        <>
          <div className="insp__warning">
            Real fetch — CORS must be permitted by the target API.
          </div>
          <input
            className="insp__url"
            type="text"
            value={config.url ?? ''}
            onChange={(e) => set({ url: e.target.value })}
            disabled={running}
            placeholder="https://api.example.com/endpoint"
          />
        </>
      )}
    </div>
  );
}

function ExtractConfigEditor({ node, running, availablePaths, onConfigChange }) {
  const config      = node.data.config ?? {};
  const currentPath = config.collectionPath ?? '';
  const set         = (path) => onConfigChange(node.id, { ...config, collectionPath: path });

  return (
    <div className="insp__editor">
      <div className="insp__editor-label">Collection path</div>

      {availablePaths.length > 0 && (
        <div className="insp__chips">
          {availablePaths.map(({ path, type, length }) => (
            <button
              key={path}
              className={`insp__chip ${currentPath === path ? 'insp__chip--active' : ''} ${type === 'array' ? 'insp__chip--array' : 'insp__chip--scalar'}`}
              onClick={() => set(path)}
              disabled={running}
            >
              <span className="insp__chip-path">{path}</span>
              <span className="insp__chip-meta">
                {type === 'array' ? `[${length}]` : 'scalar'}
              </span>
            </button>
          ))}
        </div>
      )}

      {availablePaths.length === 0 && (
        <div className="insp__chips-hint">Run the flow to detect available paths.</div>
      )}

      <input
        className="insp__path-input"
        value={currentPath}
        onChange={(e) => set(e.target.value)}
        disabled={running}
        placeholder="or type a path…"
      />
    </div>
  );
}

function ExitConfigEditor({ node, running, availableJoinKeys, onConfigChange }) {
  const config     = node.data.config ?? {};
  const currentKey = config.joinKey ?? '';
  const set        = (key) => onConfigChange(node.id, { ...config, joinKey: key });

  return (
    <div className="insp__editor">
      <div className="insp__editor-label">Join key</div>

      {availableJoinKeys.length > 0 && (
        <div className="insp__chips">
          {availableJoinKeys.map((key) => (
            <button
              key={key}
              className={`insp__chip ${currentKey === key ? 'insp__chip--active' : ''}`}
              onClick={() => set(key)}
              disabled={running}
            >
              {key}
            </button>
          ))}
        </div>
      )}

      {availableJoinKeys.length === 0 && (
        <div className="insp__chips-hint">
          Run the flow to detect common keys across upstream collections.
        </div>
      )}

      <input
        className="insp__path-input"
        value={currentKey}
        onChange={(e) => set(e.target.value)}
        disabled={running}
        placeholder="or type a key…"
      />
    </div>
  );
}

// ─── Main Inspector ───────────────────────────────────────────────────────

export default function Inspector({ node, running, availablePaths, availableJoinKeys, onConfigChange }) {
  if (!node) {
    return (
      <div className="insp insp--empty">
        <div className="insp__empty-icon">👆</div>
        <div className="insp__hint">Click any node to inspect and configure it.</div>
      </div>
    );
  }

  const { data } = node;
  const role     = NODE_ROLE[node.id];
  const rows     = data.output ?? [];
  const columns  = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="insp">
      <div className="insp__name">{data.label}</div>

      {/* Role description */}
      {role && (
        <div className="story">
          <span className="story__role-what">{role.what}</span>
          <p className="story__role-detail">{role.detail}</p>
        </div>
      )}

      {/* Config editor — always visible, locked while running */}
      {data.nodeType === 'datasource' && (
        <DatasourceConfigEditor node={node} running={running} onConfigChange={onConfigChange} />
      )}
      {data.nodeType === 'extract' && (
        <ExtractConfigEditor
          node={node}
          running={running}
          availablePaths={availablePaths}
          onConfigChange={onConfigChange}
        />
      )}
      {data.nodeType === 'exit' && (
        <ExitConfigEditor
          node={node}
          running={running}
          availableJoinKeys={availableJoinKeys}
          onConfigChange={onConfigChange}
        />
      )}

      {/* Error message */}
      {data.status === 'error' && data.error && (
        <div className="insp__error-card">{data.error}</div>
      )}

      {/* Exit join diagram */}
      {data.nodeType === 'exit' && data.status === 'done' && (
        <ExitDiagram stats={data.stats} />
      )}

      {/* Raw response (datasource only, after run) */}
      {data.nodeType === 'datasource' && data.rawResponse && (
        <RawResponseView raw={data.rawResponse} />
      )}

      {/* Output data table */}
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
