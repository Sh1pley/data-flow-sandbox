import { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from 'reactflow';

import FlowNode from './nodes/FlowNode.jsx';
import Inspector from './components/Inspector.jsx';
import { runFlow } from './engine/executor.js';

const nodeTypes = { flowNode: FlowNode };

// ── Initial node positions ─────────────────────────────────────────────────

const IDLE_NODE = (id, nodeType, label, description, x, y) => ({
  id,
  type: 'flowNode',
  position: { x, y },
  data: { nodeType, label, description, status: 'idle', stats: null, output: null },
});

const INITIAL_NODES = [
  IDLE_NODE('auth',      'auth',      'OAuth Token',     'Fetch bearer token',        120,  30),
  IDLE_NODE('products',  'api',       'Products API',    'GET /api/products',         120, 200),
  IDLE_NODE('filter',    'filter',    'Price Filter',    'price >= $75',              380, 200),
  IDLE_NODE('brand',     'api',       'Brand Details',   'GET /api/brands/:id',       640, 200),
  IDLE_NODE('csv',       'csv',       'Inventory CSV',   'Join on sku',               900, 200),
  IDLE_NODE('transform', 'transform', 'Transform',       'Add sale_price, display_name', 1160, 200),
  IDLE_NODE('result',    'result',    'Final Dataset',   `${0} rows ready`,           1420, 200),
];

const BASE_EDGE = (id, source, target, label = '') => ({
  id,
  source,
  target,
  label,
  labelStyle: { fill: '#64748b', fontSize: 10 },
  labelBgStyle: { fill: '#0f172a' },
  animated: false,
  style: { stroke: '#334155', strokeWidth: 1.5 },
});

const INITIAL_EDGES = [
  {
    ...BASE_EDGE('auth-products', 'auth', 'products', 'auth token'),
    style: { stroke: '#7c3aed', strokeWidth: 1.5, strokeDasharray: '5 4' },
  },
  BASE_EDGE('products-filter', 'products', 'filter'),
  BASE_EDGE('filter-brand',    'filter',   'brand',   '7 rows → dedup → 3 calls'),
  BASE_EDGE('brand-csv',       'brand',    'csv'),
  BASE_EDGE('csv-transform',   'csv',      'transform'),
  BASE_EDGE('transform-result','transform','result'),
];

// ── Helpers ────────────────────────────────────────────────────────────────

const LEGEND = [
  { color: '#7c3aed', label: 'Auth (singleton, not fanned-out)' },
  { color: '#2563eb', label: 'API source / fan-out node' },
  { color: '#d97706', label: 'Filter — reduces cardinality' },
  { color: '#16a34a', label: 'CSV join — zero API calls' },
  { color: '#0891b2', label: 'Transform — reshape + compute' },
  { color: '#475569', label: 'Result — final data package' },
];

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [globalStats, setGlobalStats] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Called by executor to patch a node's data
  const updateNode = useCallback((id, partialData) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...partialData } } : n
      )
    );
    // Keep inspector in sync if this is the selected node
    setSelectedNode((sel) => {
      if (!sel || sel.id !== id) return sel;
      return { ...sel, data: { ...sel.data, ...partialData } };
    });
  }, [setNodes]);

  // Called by executor to patch an edge
  const updateEdge = useCallback((id, partial) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...partial } : e))
    );
  }, [setEdges]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setGlobalStats(null);

    // Reset all nodes to idle before re-running
    setNodes((prev) =>
      prev.map((n) => ({ ...n, data: { ...n.data, status: 'idle', stats: null, output: null } }))
    );
    setEdges(INITIAL_EDGES);
    setSelectedNode(null);

    // Small pause so the reset is visible
    await new Promise((r) => setTimeout(r, 300));

    const stats = await runFlow(updateNode, updateEdge);
    setGlobalStats(stats);
    setRunning(false);
    setDone(true);
  };

  const handleReset = () => {
    if (running) return;
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedNode(null);
    setGlobalStats(null);
    setDone(false);
  };

  const onNodeClick = useCallback((_evt, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="app">
      {/* ── Top bar ── */}
      <div className="app__bar">
        <div>
          <div className="app__title">Data Flow Sandbox</div>
          <div className="app__subtitle">Proof of concept — mocked sources</div>
        </div>

        <span className="app__scenario">
          Scenario: Footwear catalog enrichment
        </span>

        {globalStats && (
          <div className="app__stats">
            <div className="chip">
              <span>Total API calls</span>
              <span className="chip__val chip__val--blue">{globalStats.totalApiCalls}</span>
            </div>
            <div className="chip">
              <span>Saved by dedup</span>
              <span className="chip__val chip__val--green">↓ {globalStats.dedupSaved}</span>
            </div>
            <div className="chip">
              <span>Final rows</span>
              <span className="chip__val chip__val--blue">{globalStats.finalRows}</span>
            </div>
          </div>
        )}

        <div className="app__actions">
          <button className="btn btn--reset" onClick={handleReset} disabled={running}>
            ↺ Reset
          </button>
          <button className="btn btn--run" onClick={handleRun} disabled={running}>
            {running ? '⟳ Running…' : done ? '▶ Run Again' : '▶ Run Flow'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="app__body">
        <div className="app__canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.4}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#1e293b"
            />
            <Controls
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
          </ReactFlow>

          {/* Legend */}
          <div className="app__legend">
            <div className="legend__title">Node Types</div>
            {LEGEND.map(({ color, label }) => (
              <div key={label} className="legend__row">
                <div className="legend__dot" style={{ background: color }} />
                <span>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, borderTop: '1px solid #334155', paddingTop: 6 }}>
              <div className="legend__row">
                <div style={{ width: 24, height: 2, background: '#7c3aed', borderTop: '2px dashed #7c3aed', flexShrink: 0 }} />
                <span>Auth edge (singleton, shared)</span>
              </div>
              <div className="legend__row">
                <div style={{ width: 24, height: 2, background: '#38bdf8', flexShrink: 0 }} />
                <span>Data edge (carry-forward)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Inspector ── */}
        <div className="app__inspector">
          <Inspector node={selectedNode} />
        </div>
      </div>
    </div>
  );
}
