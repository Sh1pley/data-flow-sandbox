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
import GlobalsPanel from './components/GlobalsPanel.jsx';
import { runFlow } from './engine/executor.js';

// Pre-set globals — exist before the flow runs (env-var style)
const INITIAL_GLOBALS = {
  stock_threshold: { value: 75,            source: 'pre-set', status: 'ready', usedBy: ['Branch'], description: 'Min stock for healthy routing' },
  campaign_name:   { value: 'Spring Sale', source: 'pre-set', status: 'ready', usedBy: ['Urgency Path'], description: 'Active campaign label' },
};

const nodeTypes = { flowNode: FlowNode };

const IDLE_NODE = (id, nodeType, label, description, x, y) => ({
  id,
  type: 'flowNode',
  position: { x, y },
  data: { nodeType, label, description, status: 'idle', stats: null, output: null },
});

// ─── Layout: linear chain → branch diamond → merge → result ──────────────
const INITIAL_NODES = [
  IDLE_NODE('auth',     'auth',      'OAuth Token',    'Fetch bearer token',      60,  40),
  IDLE_NODE('products', 'api',       'Products API',   'GET /api/products',       60, 210),
  IDLE_NODE('filter',   'filter',    'Price Filter',   'price ≥ $75',            300, 210),
  IDLE_NODE('csv',      'csv',       'Inventory CSV',  'Join on sku',            540, 210),
  IDLE_NODE('branch',   'branch',    'Branch',         'stock ≥ 75?',            780, 210),
  IDLE_NODE('pathA',    'transform', 'Premium Path',   'Healthy stock',         1020,  90),
  IDLE_NODE('pathB',    'transform', 'Urgency Path',   'Low / out of stock',    1020, 330),
  IDLE_NODE('merge',    'merge',     'Merge',          'Combine paths',         1260, 210),
  IDLE_NODE('result',   'result',    'Final Dataset',  '0 rows ready',          1500, 210),
];

const BASE_EDGE = (id, source, target, extra = {}) => ({
  id, source, target,
  animated: false,
  style: { stroke: '#334155', strokeWidth: 1.5 },
  labelStyle: { fill: '#64748b', fontSize: 9 },
  labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
  labelBgPadding: [3, 5],
  labelBgBorderRadius: 4,
  ...extra,
});

const INITIAL_EDGES = [
  BASE_EDGE('auth-products', 'auth', 'products', {
    label: 'auth token',
    style: { stroke: '#7c3aed', strokeWidth: 1.5, strokeDasharray: '5 4' },
    labelStyle: { fill: '#7c3aed', fontSize: 9 },
  }),
  BASE_EDGE('products-filter', 'products', 'filter'),
  BASE_EDGE('filter-csv',      'filter',   'csv'),
  BASE_EDGE('csv-branch',      'csv',      'branch'),

  // Branch → two paths (colored handles)
  BASE_EDGE('branch-pathA', 'branch', 'pathA', {
    sourceHandle: 'path-a',
    label: 'stock ≥ 75',
    style: { stroke: '#4ade8044', strokeWidth: 1.5 },
    labelStyle: { fill: '#4ade80', fontSize: 9 },
  }),
  BASE_EDGE('branch-pathB', 'branch', 'pathB', {
    sourceHandle: 'path-b',
    label: 'stock < 75',
    style: { stroke: '#fb923c44', strokeWidth: 1.5 },
    labelStyle: { fill: '#fb923c', fontSize: 9 },
  }),

  // Two paths → merge
  BASE_EDGE('pathA-merge', 'pathA', 'merge', {
    targetHandle: 'from-a',
    style: { stroke: '#4ade8044', strokeWidth: 1.5 },
  }),
  BASE_EDGE('pathB-merge', 'pathB', 'merge', {
    targetHandle: 'from-b',
    style: { stroke: '#fb923c44', strokeWidth: 1.5 },
  }),

  BASE_EDGE('merge-result', 'merge', 'result'),
];

const LEGEND = [
  { color: '#7c3aed', label: 'Auth (singleton — not in any path)' },
  { color: '#2563eb', label: 'API source' },
  { color: '#d97706', label: 'Filter — reduces cardinality' },
  { color: '#16a34a', label: 'CSV join — zero API calls' },
  { color: '#f59e0b', label: 'Branch — splits rows by condition' },
  { color: '#0891b2', label: 'Transform — path-specific enrichment' },
  { color: '#8b5cf6', label: 'Merge — proves no rows lost' },
  { color: '#475569', label: 'Result — final data package' },
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [running, setRunning]         = useState(false);
  const [done, setDone]               = useState(false);
  const [globalStats, setGlobalStats] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [globals, setGlobals]         = useState(INITIAL_GLOBALS);

  const setGlobal = useCallback((key, meta) => {
    setGlobals((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...meta },
    }));
  }, []);

  const updateNode = useCallback((id, partialData) => {
    setNodes((prev) =>
      prev.map((n) => n.id === id ? { ...n, data: { ...n.data, ...partialData } } : n)
    );
    setSelectedNode((sel) => {
      if (!sel || sel.id !== id) return sel;
      return { ...sel, data: { ...sel.data, ...partialData } };
    });
  }, [setNodes]);

  const updateEdge = useCallback((id, partial) => {
    setEdges((prev) => prev.map((e) => e.id === id ? { ...e, ...partial } : e));
  }, [setEdges]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setGlobalStats(null);
    setNodes((prev) =>
      prev.map((n) => ({ ...n, data: { ...n.data, status: 'idle', stats: null, output: null } }))
    );
    setEdges(INITIAL_EDGES);
    setGlobals(INITIAL_GLOBALS);
    setSelectedNode(null);
    await new Promise((r) => setTimeout(r, 300));
    const stats = await runFlow(updateNode, updateEdge, setGlobal);
    setGlobalStats(stats);
    setRunning(false);
    setDone(true);
  };

  const handleReset = () => {
    if (running) return;
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setGlobals(INITIAL_GLOBALS);
    setSelectedNode(null);
    setGlobalStats(null);
    setDone(false);
  };

  const onNodeClick  = useCallback((_e, node) => setSelectedNode(node), []);
  const onPaneClick  = useCallback(() => setSelectedNode(null), []);

  return (
    <div className="app">
      {/* ── Top bar ── */}
      <div className="app__bar">
        <div>
          <div className="app__title">Data Flow Sandbox</div>
          <div className="app__subtitle">Proof of concept — mocked sources</div>
        </div>

        <span className="app__scenario">Scenario: Footwear catalog · conditional paths</span>

        {globalStats && (
          <div className="app__stats">
            <div className="chip">
              <span>API calls</span>
              <span className="chip__val chip__val--blue">{globalStats.totalApiCalls}</span>
            </div>
            <div className="chip chip--a">
              <span className="chip__dot chip__dot--green" />
              <span>Path A (premium)</span>
              <span className="chip__val chip__val--green">{globalStats.pathARows} rows</span>
            </div>
            <div className="chip chip--b">
              <span className="chip__dot chip__dot--amber" />
              <span>Path B (urgency)</span>
              <span className="chip__val chip__val--amber">{globalStats.pathBRows} rows</span>
            </div>
            <div className="chip">
              <span>Merged</span>
              <span className="chip__val chip__val--blue">
                {globalStats.pathARows} + {globalStats.pathBRows} = {globalStats.finalRows} ✓
              </span>
            </div>
          </div>
        )}

        <div className="app__actions">
          <button className="btn btn--reset" onClick={handleReset} disabled={running}>↺ Reset</button>
          <button className="btn btn--run"   onClick={handleRun}   disabled={running}>
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
            minZoom={0.3}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
            <Controls style={{ background: '#1e293b', border: '1px solid #334155' }} />
          </ReactFlow>

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
                <div style={{ width: 24, height: 2, borderTop: '2px dashed #7c3aed', flexShrink: 0 }} />
                <span>Auth edge (singleton)</span>
              </div>
              <div className="legend__row">
                <div style={{ width: 24, height: 2, background: '#4ade80', flexShrink: 0 }} />
                <span>Path A — premium</span>
              </div>
              <div className="legend__row">
                <div style={{ width: 24, height: 2, background: '#fb923c', flexShrink: 0 }} />
                <span>Path B — urgency</span>
              </div>
            </div>
          </div>
        </div>

        <div className="app__inspector">
          <GlobalsPanel globals={globals} />
          <Inspector node={selectedNode} />
        </div>
      </div>
    </div>
  );
}
