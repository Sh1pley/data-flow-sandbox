import { useCallback, useState } from 'react';
import ReactFlow, {
  Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState,
} from 'reactflow';

import FlowNode from './nodes/FlowNode.jsx';
import Inspector from './components/Inspector.jsx';
import { runFlow } from './engine/executor.js';

const nodeTypes = { flowNode: FlowNode };

const N = (id, nodeType, label, description, x, y) => ({
  id, type: 'flowNode', position: { x, y },
  data: { nodeType, label, description, status: 'idle', stats: null, output: null, rawResponse: null },
});

// Three independent API calls → three separate Extract nodes → one Preview.
// Each API makes exactly one call. No fan-out.
// Preview joins all three collections on sku via Object.assign.
//
//              Auth
//           /    |    \
//  Products  Inventory  Reviews
//     DS        DS        DS
//      ↓         ↓         ↓
//   Extract   Extract   Extract
//      ↓         ↓         ↓
//      └─────────┴─────────┘
//               Preview
//          (joined on sku)

const INITIAL_NODES = [
  N('auth',         'auth',       'OAuth Token',     'Fetch bearer token',              400,  30),
  N('ds_products',  'datasource', 'Products API',    'GET /api/products',               100, 180),
  N('ex_products',  'extract',    'Extract',         'collection_path: "products"',     100, 350),
  N('ds_inventory', 'datasource', 'Inventory API',   'GET /api/inventory',              400, 180),
  N('ex_inventory', 'extract',    'Extract',         'collection_path: "inventory"',    400, 350),
  N('ds_reviews',   'datasource', 'Reviews API',     'GET /api/reviews',                700, 180),
  N('ex_reviews',   'extract',    'Extract',         'collection_path: "reviews"',      700, 350),
  N('preview',      'preview',    'Preview',         'Joined on sku',                   400, 520),
];

const E = (id, source, target, extra = {}) => ({
  id, source, target, animated: false,
  style: { stroke: '#334155', strokeWidth: 1.5 },
  labelStyle: { fill: '#64748b', fontSize: 9 },
  labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
  labelBgPadding: [3, 5], labelBgBorderRadius: 4,
  ...extra,
});

const AUTH_EDGE = (id, target) => E(id, 'auth', target, {
  style: { stroke: '#7c3aed', strokeWidth: 1.5, strokeDasharray: '5 4' },
  labelStyle: { fill: '#7c3aed', fontSize: 9 },
  label: 'auth token',
});

const INITIAL_EDGES = [
  AUTH_EDGE('auth-ds_products',  'ds_products'),
  AUTH_EDGE('auth-ds_inventory', 'ds_inventory'),
  AUTH_EDGE('auth-ds_reviews',   'ds_reviews'),
  E('ds_products-ex_products',   'ds_products',  'ex_products',  { label: 'raw response' }),
  E('ds_inventory-ex_inventory', 'ds_inventory', 'ex_inventory', { label: 'raw response' }),
  E('ds_reviews-ex_reviews',     'ds_reviews',   'ex_reviews',   { label: 'raw response' }),
  E('ex_products-preview',       'ex_products',  'preview'),
  E('ex_inventory-preview',      'ex_inventory', 'preview'),
  E('ex_reviews-preview',        'ex_reviews',   'preview'),
];

const LEGEND = [
  { color: '#7c3aed', label: 'Auth — singleton token'                           },
  { color: '#1d4ed8', label: 'Data Source — one call, raw envelope'             },
  { color: '#6d28d9', label: 'Extract — collection_path, typed collection out'  },
  { color: '#059669', label: 'Preview — three collections joined on sku'        },
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [running, setRunning]           = useState(false);
  const [done, setDone]                 = useState(false);
  const [globalStats, setGlobalStats]   = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const updateNode = useCallback((id, partial) => {
    setNodes((prev) => prev.map((n) => n.id === id ? { ...n, data: { ...n.data, ...partial } } : n));
    setSelectedNode((sel) => {
      if (!sel || sel.id !== id) return sel;
      return { ...sel, data: { ...sel.data, ...partial } };
    });
  }, [setNodes]);

  const updateEdge = useCallback((id, partial) => {
    setEdges((prev) => prev.map((e) => e.id === id ? { ...e, ...partial } : e));
  }, [setEdges]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true); setDone(false); setGlobalStats(null);
    setNodes((prev) => prev.map((n) => ({
      ...n, data: { ...n.data, status: 'idle', stats: null, output: null, rawResponse: null },
    })));
    setEdges(INITIAL_EDGES);
    setSelectedNode(null);
    await new Promise((r) => setTimeout(r, 300));
    const s = await runFlow(updateNode, updateEdge);
    setGlobalStats(s);
    setRunning(false); setDone(true);
  };

  const handleReset = () => {
    if (running) return;
    setNodes(INITIAL_NODES); setEdges(INITIAL_EDGES);
    setSelectedNode(null); setGlobalStats(null); setDone(false);
  };

  return (
    <div className="app">
      <div className="app__bar">
        <div>
          <div className="app__title">Data Flow Sandbox</div>
          <div className="app__subtitle">Collection model · Phase 1–5 POC</div>
        </div>

        <span className="app__scenario">3 independent APIs · collected into one dataset</span>

        {globalStats && (
          <div className="app__stats">
            <div className="chip">
              <span>API calls</span>
              <span className="chip__val chip__val--blue">{globalStats.totalApiCalls}</span>
            </div>
            <div className="chip">
              <span>Final dataset</span>
              <span className="chip__val chip__val--green">
                {globalStats.finalRows} rows · {globalStats.finalFields} fields
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

      <div className="app__body">
        <div className="app__canvas">
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3} maxZoom={1.8}
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
                <span>Auth (not carry-forward)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="app__inspector">
          <Inspector node={selectedNode} />
        </div>
      </div>
    </div>
  );
}
