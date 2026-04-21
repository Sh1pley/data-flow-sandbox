import { Handle, Position } from 'reactflow';
import './FlowNode.css';

const TYPE_CONFIG = {
  auth:      { color: '#7c3aed', icon: '🔑', badge: 'AUTH'      },
  api:       { color: '#2563eb', icon: '🌐', badge: 'API'       },
  filter:    { color: '#d97706', icon: '⬇',  badge: 'FILTER'    },
  csv:       { color: '#16a34a', icon: '📋', badge: 'CSV JOIN'  },
  branch:    { color: '#f59e0b', icon: '◇',  badge: 'BRANCH'    },
  transform: { color: '#0891b2', icon: '⚙',  badge: 'TRANSFORM' },
  merge:     { color: '#8b5cf6', icon: '◈',  badge: 'MERGE'     },
  result:    { color: '#475569', icon: '📦', badge: 'RESULT'    },
};

const STATUS_SYMBOL = { idle: '○', running: '◌', done: '✓', error: '✗' };

function NodeStats({ data }) {
  const s = data.stats ?? {};
  const t = data.nodeType;

  if (t === 'branch' && s.pathARows !== undefined) {
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k">in</span>
          <span className="fn__stat-v">{s.inputRows} rows</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k fn__path-a-label">path A</span>
          <span className="fn__stat-v fn__stat-v--green">{s.pathARows} rows</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k fn__path-b-label">path B</span>
          <span className="fn__stat-v fn__stat-v--amber">{s.pathBRows} rows</span>
        </div>
      </div>
    );
  }

  if (t === 'merge' && s.pathARows !== undefined) {
    const balanced = s.pathARows + s.pathBRows === s.outputRows;
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k fn__path-a-label">from A</span>
          <span className="fn__stat-v fn__stat-v--green">+{s.pathARows}</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k fn__path-b-label">from B</span>
          <span className="fn__stat-v fn__stat-v--amber">+{s.pathBRows}</span>
        </div>
        <div className="fn__stat fn__stat--ruled">
          <span className="fn__stat-k">total</span>
          <span className={`fn__stat-v ${balanced ? 'fn__stat-v--hi' : 'fn__stat-v--err'}`}>
            {s.outputRows} {balanced ? '✓' : '✗'}
          </span>
        </div>
      </div>
    );
  }

  return (
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
          </span>
        </div>
      )}
    </div>
  );
}

export default function FlowNode({ data, selected }) {
  const cfg = TYPE_CONFIG[data.nodeType] ?? TYPE_CONFIG.api;
  const isDone    = data.status === 'done';
  const isRunning = data.status === 'running';
  const isBranch  = data.nodeType === 'branch';
  const isMerge   = data.nodeType === 'merge';

  return (
    <div
      className={`fn ${isRunning ? 'fn--running' : ''} ${selected ? 'fn--selected' : ''} ${isBranch ? 'fn--branch' : ''}`}
      style={{ '--nc': cfg.color }}
    >
      {/* Input handles */}
      {data.nodeType === 'auth' ? null : isMerge ? (
        <>
          <Handle type="target" position={Position.Left} id="from-a" className="fn__handle fn__handle--a" style={{ top: '32%' }} />
          <Handle type="target" position={Position.Left} id="from-b" className="fn__handle fn__handle--b" style={{ top: '68%' }} />
        </>
      ) : (
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

      <div className="fn__badge">{cfg.badge}</div>

      {/* Body */}
      <div className="fn__body">
        {!isDone && !isRunning && <span className="fn__idle">waiting</span>}
        {isRunning && <span className="fn__running-label">executing…</span>}
        {isDone && <NodeStats data={data} />}
      </div>

      {/* Branch path labels next to handles */}
      {isBranch && isDone && (
        <>
          <span className="fn__path-label fn__path-label--a">stock ≥ 75</span>
          <span className="fn__path-label fn__path-label--b">stock &lt; 75</span>
        </>
      )}

      {/* Output handles */}
      {data.nodeType === 'result' ? null : isBranch ? (
        <>
          <Handle type="source" position={Position.Right} id="path-a" className="fn__handle fn__handle--a" style={{ top: '32%' }} />
          <Handle type="source" position={Position.Right} id="path-b" className="fn__handle fn__handle--b" style={{ top: '68%' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="fn__handle" />
      )}
    </div>
  );
}
