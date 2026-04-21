import { Handle, Position } from 'reactflow';
import './FlowNode.css';

const TYPE_CONFIG = {
  auth:      { color: '#7c3aed', icon: '🔑', badge: 'AUTH'      },
  api:       { color: '#2563eb', icon: '🌐', badge: 'API'       },
  filter:    { color: '#d97706', icon: '⬇',  badge: 'FILTER'    },
  csv:       { color: '#16a34a', icon: '📋', badge: 'CSV JOIN'  },
  transform: { color: '#0891b2', icon: '⚙',  badge: 'TRANSFORM' },
  result:    { color: '#475569', icon: '📦', badge: 'RESULT'    },
};

const STATUS_SYMBOL = { idle: '○', running: '◌', done: '✓', error: '✗' };

export default function FlowNode({ data, selected }) {
  const cfg = TYPE_CONFIG[data.nodeType] ?? TYPE_CONFIG.api;
  const s   = data.stats ?? {};
  const isDone    = data.status === 'done';
  const isRunning = data.status === 'running';

  return (
    <div
      className={`fn ${isRunning ? 'fn--running' : ''} ${selected ? 'fn--selected' : ''}`}
      style={{ '--nc': cfg.color }}
    >
      {data.nodeType !== 'auth' && (
        <Handle type="target" position={Position.Left} className="fn__handle" />
      )}

      {/* Header */}
      <div className="fn__head">
        <span className="fn__icon">{cfg.icon}</span>
        <div className="fn__titles">
          <div className="fn__label">{data.label}</div>
          <div className="fn__desc">{data.description}</div>
        </div>
        <span className={`fn__status fn__status--${data.status}`}>
          {STATUS_SYMBOL[data.status] ?? '○'}
        </span>
      </div>

      {/* Type badge */}
      <div className="fn__badge">{cfg.badge}</div>

      {/* Body */}
      <div className="fn__body">
        {!isDone && !isRunning && (
          <span className="fn__idle">waiting</span>
        )}

        {isRunning && (
          <span className="fn__running-label">executing…</span>
        )}

        {isDone && (
          <div className="fn__stats">
            {s.inputRows !== undefined && (
              <div className="fn__stat">
                <span className="fn__stat-k">in</span>
                <span className="fn__stat-v">{s.inputRows} rows</span>
              </div>
            )}
            <div className="fn__stat">
              <span className="fn__stat-k">out</span>
              <span className="fn__stat-v fn__stat-v--hi">{s.outputRows} rows</span>
            </div>
            {s.apiCalls !== undefined && (
              <div className="fn__stat">
                <span className="fn__stat-k">api calls</span>
                <span className={`fn__stat-v ${s.apiCalls === 0 ? 'fn__stat-v--zero' : ''}`}>
                  {s.apiCalls}
                  {s.dedupSaved > 0 && (
                    <span className="fn__dedup"> ↓{s.dedupSaved} saved</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {data.nodeType !== 'result' && (
        <Handle type="source" position={Position.Right} className="fn__handle" />
      )}
    </div>
  );
}
