import { Handle, Position } from 'reactflow';
import './FlowNode.css';

const TYPE_CONFIG = {
  datasource: { color: '#1d4ed8', icon: '📡', badge: 'DATA SOURCE' },
  extract:    { color: '#6d28d9', icon: '⬡',  badge: 'EXTRACT'     },
  exit:       { color: '#0d9488', icon: '◉',  badge: 'EXIT'        },
};

const STATUS_SYMBOL = { idle: '○', running: '◌', done: '✓', error: '✗' };

function truncate(str, max = 22) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function ConfigDisplay({ data }) {
  const { nodeType, config } = data;
  if (!config) return <span className="fn__unconfigured">click to configure</span>;

  if (nodeType === 'datasource') {
    if (config.mode === 'fetch' && config.url) {
      const display = config.url.replace(/^https?:\/\//, '');
      return (
        <div className="fn__config">
          <span className="fn__config-k">url</span>
          <span className="fn__config-v">{truncate(display)}</span>
        </div>
      );
    }
    if (config.pasteJson) {
      return (
        <div className="fn__config">
          <span className="fn__config-k">mode</span>
          <span className="fn__config-v">paste JSON</span>
        </div>
      );
    }
    return <span className="fn__unconfigured">click to configure</span>;
  }

  if (nodeType === 'extract') {
    return config.collectionPath ? (
      <div className="fn__config">
        <span className="fn__config-k">path</span>
        <span className="fn__config-v fn__config-v--mono">"{config.collectionPath}"</span>
      </div>
    ) : (
      <span className="fn__unconfigured">select a path →</span>
    );
  }

  if (nodeType === 'exit') {
    return config.joinKey ? (
      <div className="fn__config">
        <span className="fn__config-k">join</span>
        <span className="fn__config-v fn__config-v--mono">"{config.joinKey}"</span>
      </div>
    ) : (
      <span className="fn__unconfigured">select a join key →</span>
    );
  }

  return null;
}

function NodeStats({ data }) {
  const s = data.stats ?? {};
  const t = data.nodeType;

  if (t === 'datasource') {
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k">api calls</span>
          <span className="fn__stat-v">{s.apiCalls}</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">response keys</span>
          <span className="fn__stat-v fn__stat-v--dim">{s.responseKeys}</span>
        </div>
      </div>
    );
  }

  if (t === 'extract') {
    const carries = data.carries ?? [];
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
        {carries.length > 0 && (
          <div className="fn__stat fn__stat--ruled">
            <span className="fn__stat-k fn__stat-k--purple">carries</span>
            <span className="fn__stat-v fn__stat-v--mono">{carries.join(', ')}</span>
          </div>
        )}
      </div>
    );
  }

  if (t === 'exit') {
    return (
      <div className="fn__stats">
        <div className="fn__stat">
          <span className="fn__stat-k">join key</span>
          <span className="fn__stat-v fn__stat-v--mono">"{s.joinKey}"</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">sources</span>
          <span className="fn__stat-v">{s.sources}</span>
        </div>
        <div className="fn__stat fn__stat--ruled">
          <span className="fn__stat-k">rows out</span>
          <span className="fn__stat-v fn__stat-v--green">{s.outputRows}</span>
        </div>
        <div className="fn__stat">
          <span className="fn__stat-k">fields</span>
          <span className="fn__stat-v fn__stat-v--green">{s.fieldCount}</span>
        </div>
      </div>
    );
  }

  return null;
}

export default function FlowNode({ data, selected }) {
  const cfg       = TYPE_CONFIG[data.nodeType] ?? TYPE_CONFIG.datasource;
  const isDone    = data.status === 'done';
  const isRunning = data.status === 'running';
  const isError   = data.status === 'error';

  return (
    <div
      className={`fn ${isRunning ? 'fn--running' : ''} ${selected ? 'fn--selected' : ''} ${isError ? 'fn--error' : ''}`}
      style={{ '--nc': isError ? '#ef4444' : cfg.color }}
    >
      {!data.isHead && (
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
        {isError   && <span className="fn__error-msg">{data.error ?? 'Error'}</span>}
        {!isDone && !isRunning && !isError && <ConfigDisplay data={data} />}
        {isRunning && <span className="fn__running-label">executing…</span>}
        {isDone    && <NodeStats data={data} />}
      </div>

      {data.nodeType !== 'exit' && (
        <Handle type="source" position={Position.Right} className="fn__handle" />
      )}
    </div>
  );
}
