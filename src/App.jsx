import { useCallback, useState } from 'react';
import ReactFlow, {
  Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState,
} from 'reactflow';

import FlowNode from './nodes/FlowNode.jsx';
import Inspector from './components/Inspector.jsx';
import { runFlow } from './engine/executor.js';
import {
  MOCK_AUTH, MOCK_PRODUCTS, MOCK_INVENTORY, MOCK_REVIEWS,
} from './mocks/sources.js';

const nodeTypes = { flowNode: FlowNode };

// ─── Graph helpers ─────────────────────────────────────────────────────────

function detectPaths(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') return [];
  return Object.entries(rawResponse).map(([path, value]) => ({
    path,
    type:   Array.isArray(value) ? 'array' : 'scalar',
    length: Array.isArray(value) ? value.length : undefined,
  }));
}

function detectCommonKeys(collections) {
  const filled = collections.filter((c) => Array.isArray(c) && c.length > 0);
  if (filled.length === 0) return [];
  const keySets = filled.map((c) => new Set(Object.keys(c[0])));
  return [...keySets[0]].filter((k) => keySets.every((s) => s.has(k))).sort();
}

// ─── Node factory ──────────────────────────────────────────────────────────

const N = (id, nodeType, label, description, x, y, extra = {}) => ({
  id, type: 'flowNode', position: { x, y },
  data: {
    id, nodeType, label, description,
    status: 'idle', stats: null, output: null, rawResponse: null, error: null,
    config: null,
    ...extra,
  },
});

// ─── Initial graph ─────────────────────────────────────────────────────────
//
//         Auth API (getter)
//               ↓
//         Auth Extract  → [{token}]
//        /      |      \
//  Products  Inventory  Reviews
//    API        API       API
//      ↓         ↓         ↓
//   Extract   Extract   Extract
//      ↓         ↓         ↓
//      └─────────┴─────────┘
//               Exit (join on sku)
//

const INITIAL_NODES = [
  N('auth_api', 'datasource', 'Auth API', 'oauth token endpoint', 390, 20, {
    isHead: true,
    config: { mode: 'paste', url: '', pasteJson: JSON.stringify(MOCK_AUTH, null, 2) },
  }),
  N('auth_ex', 'extract', 'Auth Extract', 'token → collection', 390, 180, {
    config: { collectionPath: 'token' },
  }),
  N('ds_products', 'datasource', 'Products API', 'product catalog', 80, 340, {
    config: { mode: 'paste', url: '', pasteJson: JSON.stringify(MOCK_PRODUCTS, null, 2) },
  }),
  N('ds_inventory', 'datasource', 'Inventory API', 'stock levels', 390, 340, {
    config: { mode: 'paste', url: '', pasteJson: JSON.stringify(MOCK_INVENTORY, null, 2) },
  }),
  N('ds_reviews', 'datasource', 'Reviews API', 'review data', 700, 340, {
    config: { mode: 'paste', url: '', pasteJson: JSON.stringify(MOCK_REVIEWS, null, 2) },
  }),
  N('ex_products', 'extract', 'Products Extract', 'collection selector', 80, 500, {
    config: { collectionPath: 'products' },
  }),
  N('ex_inventory', 'extract', 'Inv Extract', 'collection selector', 390, 500, {
    config: { collectionPath: 'inventory' },
  }),
  N('ex_reviews', 'extract', 'Reviews Extract', 'collection selector', 700, 500, {
    config: { collectionPath: 'reviews' },
  }),
  N('exit', 'exit', 'Exit', 'join & output', 390, 660, {
    config: { joinKey: 'sku' },
  }),
];

const E = (id, source, target, extra = {}) => ({
  id, source, target, animated: false,
  style: { stroke: '#334155', strokeWidth: 1.5 },
  labelStyle: { fill: '#64748b', fontSize: 9 },
  labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
  labelBgPadding: [3, 5], labelBgBorderRadius: 4,
  ...extra,
});

const INITIAL_EDGES = [
  E('auth_api-auth_ex',          'auth_api',    'auth_ex'),
  E('auth_ex-ds_products',       'auth_ex',     'ds_products'),
  E('auth_ex-ds_inventory',      'auth_ex',     'ds_inventory'),
  E('auth_ex-ds_reviews',        'auth_ex',     'ds_reviews'),
  E('ds_products-ex_products',   'ds_products', 'ex_products',  { label: 'raw response' }),
  E('ds_inventory-ex_inventory', 'ds_inventory','ex_inventory', { label: 'raw response' }),
  E('ds_reviews-ex_reviews',     'ds_reviews',  'ex_reviews',   { label: 'raw response' }),
  E('ex_products-exit',          'ex_products', 'exit'),
  E('ex_inventory-exit',         'ex_inventory','exit'),
  E('ex_reviews-exit',           'ex_reviews',  'exit'),
];

const LEGEND = [
  { color: '#1d4ed8', label: 'Data Source — getter, raw response envelope' },
  { color: '#6d28d9', label: 'Extract — select collection_path, all fields' },
  { color: '#0d9488', label: 'Exit — join N collections on a key' },
];

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [running, setRunning]           = useState(false);
  const [done, setDone]                 = useState(false);
  const [globalStats, setGlobalStats]   = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const updateNode = useCallback((id, partial) => {
    setNodes((prev) => prev.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...partial } } : n
    ));
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

    // Reset execution state, preserve config
    const resetNodes = nodes.map((n) => ({
      ...n,
      data: { ...n.data, status: 'idle', stats: null, output: null, rawResponse: null, error: null },
    }));
    setNodes(resetNodes);
    setEdges(INITIAL_EDGES);
    setSelectedNode(null);
    await new Promise((r) => setTimeout(r, 300));

    const s = await runFlow(resetNodes, INITIAL_EDGES, updateNode, updateEdge);
    setGlobalStats(s);
    setRunning(false); setDone(true);
  };

  const handleReset = () => {
    if (running) return;
    // Preserve user config, only clear execution state
    setNodes((prev) => prev.map((n) => ({
      ...n,
      data: { ...n.data, status: 'idle', stats: null, output: null, rawResponse: null, error: null },
    })));
    setEdges(INITIAL_EDGES);
    setSelectedNode(null); setGlobalStats(null); setDone(false);
  };

  // ─── Compute available paths/keys for the selected node ──────────────────

  let availablePaths    = [];
  let availableJoinKeys = [];

  if (selectedNode?.data.nodeType === 'extract') {
    const upEdge  = edges.find((e) => e.target === selectedNode.id);
    const upNode  = upEdge ? nodes.find((n) => n.id === upEdge.source) : null;
    if (upNode?.data.rawResponse) {
      availablePaths = detectPaths(upNode.data.rawResponse);
    }
  }

  if (selectedNode?.data.nodeType === 'exit') {
    const upCollections = edges
      .filter((e) => e.target === selectedNode.id)
      .map((e) => nodes.find((n) => n.id === e.source)?.data.output)
      .filter(Boolean);
    availableJoinKeys = detectCommonKeys(upCollections);
  }

  return (
    <div className="app">
      <div className="app__bar">
        <div>
          <div className="app__title">Data Flow Sandbox</div>
          <div className="app__subtitle">Explicit architecture · getter → extract → exit</div>
        </div>

        {globalStats && (
          <div className="app__stats">
            <div className="chip">
              <span>API calls</span>
              <span className="chip__val chip__val--blue">{globalStats.totalApiCalls}</span>
            </div>
            <div className="chip">
              <span>Output</span>
              <span className="chip__val chip__val--green">
                {globalStats.outputRows} rows · {globalStats.outputFields} fields
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
          </div>
        </div>

        <div className="app__inspector">
          <Inspector
            node={selectedNode}
            running={running}
            availablePaths={availablePaths}
            availableJoinKeys={availableJoinKeys}
            onConfigChange={(nodeId, cfg) => updateNode(nodeId, { config: cfg })}
          />
        </div>
      </div>
    </div>
  );
}
