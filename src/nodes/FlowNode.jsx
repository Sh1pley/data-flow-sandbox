import { Handle, Position } from 'reactflow';
import './FlowNode.css';

const TYPE_CONFIG = {
  auth:       { color: '#7c3aed', icon: '🔑', badge: 'AUTH'        },
  datasource: { color: '#1d4ed8', icon: '📡', badge: 'DATA SOURCE' },
  extract:    { color: '#6d28d9', icon: '🔬', badge: 'EXTRACT'     },
  fanout:     { color: '#0e7490', icon: '⤢',  badge: 'FAN-OUT'     },
  preview:    { color: '#059669', icon: '▣',  badge: 'PREVIEW'     },
};

const STATUS_SYMBOL = { idle: '○', running: '◌', done: '✓', error: '✗' };

function NodeStats({ data }) {
  const s = data.stats ?? {};
  const t = data.nodeType;

  if (t === 'datasource' && data.id !== 'ds_reviews' && s.responseKeys) {
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k">api calls</span>
          <span className="fn__stat-v">{s.apiCalls}</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">arrays</span>
          <span className="fn__stat-v fn__stat-v--blue">{s.arrays}</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">scalars</span>
          <span className="fn__stat-v fn__stat-v--dim">{s.scalars}</span>
        </div>
      </div>
    );
  }

  if (t === 'extract') {
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k">collection_path</span>
          <span className="fn__stat-v fn__stat-v--mono">"{s.collectionPath}"</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">rows out</span>
          <span className="fn__stat-v fn__stat-v--blue">{s.outputRows}</span>
        </div>
        {s.crossJoinNote && (
          <div className="fn__stat">
            <span className="fn__stat-k fn__stat-k--purple">cross-join</span>
            <span className="fn__stat-v fn__stat-v--purple">{s.crossJoinNote}</span>
          </div>
        )}
      </div>
    );
  }

  if (t === 'fanout' && s.fanoutCalls !== undefined) {
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k">fan-out calls</span>
          <span className="fn__stat-v fn__stat-v--blue">{s.fanoutCalls}</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">fields added</span>
          <span className="fn__stat-v fn__stat-v--green">+{s.fieldsAdded}</span>
        </div>
        <div className="fn__stat fn__stat--ruled">
          <span className="fn__stat-k">rows out</span>
          <span className="fn__stat-v fn__stat-v--blue">{s.outputRows}</span>
        </div>
      </div>
    );
  }

  if (t === 'preview') {
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k">rows</span>
          <span className="fn__stat-v fn__stat-v--green">{s.outputRows}</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">fields</span>
          <span className="fn__stat-v fn__stat-v--green">{s.fieldCount}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fn__stats">
      {s.outputRows !== undefined && (
        <div className="fn__stat">
          <span className="fn__stat-k">out</span>
          <span className="fn__stat-v fn__stat-v--blue">{s.outputRows} rows</span>
        </div>
      )}
      {s.apiCalls !== undefined && (
        <div className="fn__stat">
          <span className="fn__stat-k">api calls</span>
          <span className="fn__stat-v">{s.apiCalls}</span>
        </div>
      )}
    </div>
  );
}

export default function FlowNode({ data, selected }) {
  const cfg = TYPE_CONFIG[data.nodeType] ?? TYPE_CONFIG.datasource;
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

      <div className="fn__body">
        {!isDone && !isRunning && <span className="fn__idle">waiting</span>}
        {isRunning && <span className="fn__running-label">executing…</span>}
        {isDone && <NodeStats data={data} />}
      </div>

      {data.nodeType !== 'preview' && (
        <Handle type="source" position={Position.Right} className="fn__handle" />
      )}
    </div>
  );
}
