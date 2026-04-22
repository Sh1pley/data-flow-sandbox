import './GlobalsPanel.css';

const SOURCE_COLOR = {
  'pre-set':     '#64748b',
  'OAuth Token': '#7c3aed',
  'Products API':'#2563eb',
};

const STATUS_LABEL = {
  ready:   { text: 'ready',    cls: 'gp__status--ready'   },
  active:  { text: 'set',      cls: 'gp__status--active'  },
  reading: { text: 'in use',   cls: 'gp__status--reading' },
};

function formatVal(v) {
  if (typeof v === 'number') return <span className="gp__val-num">{v}</span>;
  const s = String(v);
  return <span className="gp__val-str">{s.length > 24 ? s.slice(0, 22) + '…' : s}</span>;
}

export default function GlobalsPanel({ globals }) {
  const entries = Object.entries(globals);
  const activeCount = entries.filter(([, m]) => m.status !== 'ready').length;

  return (
    <div className="gp">
      <div className="gp__header">
        <span className="gp__title">
          <span className="gp__icon">◎</span> Global Scope
        </span>
        <span className="gp__counts">
          <span className="gp__count-total">{entries.length} vars</span>
          {activeCount > 0 && (
            <span className="gp__count-active">{activeCount} live</span>
          )}
        </span>
      </div>

      <div className="gp__desc">
        Values available to every node — filters, branches, transforms — regardless of graph position.
      </div>

      {entries.length === 0 ? (
        <div className="gp__empty">No globals set — run the flow</div>
      ) : (
        <div className="gp__list">
          {entries.map(([key, meta]) => {
            const sl = STATUS_LABEL[meta.status] ?? STATUS_LABEL.ready;
            const srcColor = SOURCE_COLOR[meta.source] ?? '#64748b';
            return (
              <div key={key} className={`gp__entry ${meta.status === 'active' ? 'gp__entry--active' : ''}`}>
                <div className="gp__row-top">
                  <span className="gp__key">${key}</span>
                  <span className={`gp__status ${sl.cls}`}>{sl.text}</span>
                </div>
                <div className="gp__row-bottom">
                  <span className="gp__value">{formatVal(meta.value)}</span>
                  <span className="gp__source" style={{ color: srcColor }}>
                    ← {meta.source}
                  </span>
                </div>
                {meta.usedBy && meta.usedBy.length > 0 && (
                  <div className="gp__used-by">
                    used in: {meta.usedBy.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
