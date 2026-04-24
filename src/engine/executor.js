const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const stampEdge = (updateEdge, id, label, color = '#334155') =>
  updateEdge(id, {
    animated: false,
    style: { stroke: color, strokeWidth: 1.5 },
    label,
    labelStyle: { fill: color === '#334155' ? '#64748b' : color, fontSize: 9 },
    labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
    labelBgPadding: [3, 5],
    labelBgBorderRadius: 4,
  });

const glow = (updateEdge, id, color = '#38bdf8') =>
  updateEdge(id, { animated: true, style: { stroke: color, strokeWidth: 2 } });

// ─── Graph helpers ─────────────────────────────────────────────────────────

function buildGraph(edges) {
  const inEdges  = {};  // targetId → [sourceId]
  const edgeById = {};  // `${src}->${tgt}` → edgeId
  edges.forEach((e) => {
    (inEdges[e.target] = inEdges[e.target] ?? []).push(e.source);
    edgeById[`${e.source}->${e.target}`] = e.id;
  });
  return { inEdges, edgeById };
}

function topoSort(nodeIds, inEdges) {
  const inDegree   = Object.fromEntries(nodeIds.map((id) => [id, (inEdges[id] ?? []).length]));
  const dependents = {};
  nodeIds.forEach((id) =>
    (inEdges[id] ?? []).forEach((src) => {
      (dependents[src] = dependents[src] ?? []).push(id);
    })
  );
  const queue  = nodeIds.filter((id) => inDegree[id] === 0);
  const result = [];
  while (queue.length) {
    const id = queue.shift();
    result.push(id);
    (dependents[id] ?? []).forEach((dep) => {
      if (--inDegree[dep] === 0) queue.push(dep);
    });
  }
  return result;
}

// ─── Collection helpers ────────────────────────────────────────────────────

function extractCollection(raw, path) {
  if (!raw || !path) return [];
  const value = raw[path];
  if (Array.isArray(value)) return value;
  if (value === undefined) return [];
  return [{ [path]: value }];
}

function joinCollections(collections, joinKey) {
  const [primary, ...rest] = collections;
  const lookups = rest.map((c) =>
    Object.fromEntries(c.map((item) => [item[joinKey], item]))
  );
  return primary.map((item) =>
    Object.assign({}, item, ...lookups.map((lk) => lk[item[joinKey]] ?? {}))
  );
}

// ─── Node handlers ─────────────────────────────────────────────────────────

async function runDatasource(node, upstreamIds, context, stats, edgeById, updateNode, updateEdge) {
  const { id, data } = node;
  const { config }   = data;

  // Unpack auth token from any upstream collection
  const token = upstreamIds
    .map((uid) => context[uid])
    .find((v) => Array.isArray(v))
    ?.[0]?.token;

  let rawResponse;

  if (config?.mode === 'fetch' && config?.url) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = token;
    const res = await fetch(config.url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${config.url}`);
    rawResponse = await res.json();
  } else if (config?.pasteJson) {
    rawResponse = JSON.parse(config.pasteJson);
  } else {
    throw new Error('No URL or paste JSON configured for this datasource.');
  }

  stats.totalApiCalls += 1;
  context[id] = rawResponse;

  updateNode(id, {
    status: 'done',
    rawResponse,
    stats: { apiCalls: 1, responseKeys: Object.keys(rawResponse).join(', ') },
  });

  // Animate outgoing edges — token edges purple, data edges default
  Object.entries(edgeById).forEach(([key, eid]) => {
    if (!key.startsWith(`${id}->`)) return;
    const targetId   = key.split('->')[1];
    const targetCtx  = context[targetId];
    const isTokenEdge = Array.isArray(context[id]) || (token && upstreamIds.length > 0);
    // If this datasource is itself an auth source (its output is later used as token), stamp token style
    stampEdge(updateEdge, eid, 'raw response');
    glow(updateEdge, eid);
  });

  await pause(200);
}

async function runExtract(node, upstreamIds, context, edgeById, updateNode, updateEdge) {
  const { id, data } = node;
  const { config }   = data;

  // Find upstream raw response (non-array object from a datasource)
  const rawResponse = upstreamIds
    .map((uid) => context[uid])
    .find((v) => v && typeof v === 'object' && !Array.isArray(v));

  if (!rawResponse) throw new Error('No upstream raw response available.');

  const path = config?.collectionPath;
  if (!path) throw new Error('No collection_path configured — select a path in the inspector.');

  const collection = extractCollection(rawResponse, path);
  context[id] = collection;

  updateNode(id, {
    status: 'done',
    output: collection,
    stats: { collectionPath: path, outputRows: collection.length },
  });

  const label = `${collection.length} row${collection.length !== 1 ? 's' : ''}`;
  Object.entries(edgeById).forEach(([key, eid]) => {
    if (!key.startsWith(`${id}->`)) return;
    stampEdge(updateEdge, eid, label);
    glow(updateEdge, eid);
  });

  await pause(200);
}

async function runExit(node, upstreamIds, context, stats, updateNode) {
  const { id, data } = node;
  const { config }   = data;

  const collections = upstreamIds
    .map((uid) => context[uid])
    .filter((v) => Array.isArray(v));

  if (collections.length === 0) throw new Error('No upstream collections connected to exit.');

  const joinKey = config?.joinKey;
  let joined;

  if (joinKey && collections.length > 1) {
    joined = joinCollections(collections, joinKey);
  } else {
    joined = collections.flat();
  }

  stats.outputRows   = joined.length;
  stats.outputFields = joined.length > 0 ? Object.keys(joined[0]).length : 0;
  context[id] = joined;

  updateNode(id, {
    status: 'done',
    output: joined,
    stats: {
      joinKey:    joinKey ?? '(none)',
      sources:    collections.length,
      outputRows: stats.outputRows,
      fieldCount: stats.outputFields,
    },
  });

  await pause(200);
}

// ─── Auth-extract edge annotation ─────────────────────────────────────────
// After an extract whose output is a single-item collection with a token field,
// stamp its outgoing edges as purple token edges.

function annotateTokenEdges(node, context, edgeById, updateEdge) {
  const collection = context[node.id];
  if (!Array.isArray(collection) || collection.length !== 1) return;
  if (!collection[0]?.token) return;
  Object.entries(edgeById).forEach(([key, eid]) => {
    if (!key.startsWith(`${node.id}->`)) return;
    stampEdge(updateEdge, eid, '[{token}]', '#7c3aed');
    glow(updateEdge, eid, '#7c3aed');
  });
}

// ─── Main entry ───────────────────────────────────────────────────────────

export async function runFlow(nodes, edges, updateNode, updateEdge) {
  const stats = { totalApiCalls: 0, outputRows: 0, outputFields: 0 };
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const { inEdges, edgeById } = buildGraph(edges);
  const order = topoSort(Object.keys(nodeMap), inEdges);
  const context = {};

  for (const nodeId of order) {
    const node        = nodeMap[nodeId];
    const upstreamIds = inEdges[nodeId] ?? [];

    updateNode(nodeId, { status: 'running' });
    await pause(300);

    try {
      if (node.data.nodeType === 'datasource') {
        await runDatasource(node, upstreamIds, context, stats, edgeById, updateNode, updateEdge);
      } else if (node.data.nodeType === 'extract') {
        await runExtract(node, upstreamIds, context, edgeById, updateNode, updateEdge);
        annotateTokenEdges(node, context, edgeById, updateEdge);
      } else if (node.data.nodeType === 'exit') {
        await runExit(node, upstreamIds, context, stats, updateNode);
      }
    } catch (err) {
      updateNode(nodeId, { status: 'error', error: err.message });
      // Continue running other nodes rather than aborting the whole flow
    }
  }

  return stats;
}
