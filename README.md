# data-flow-sandbox

A React + ReactFlow playground that visualizes the spirit of the production Data Flows feature: a graph of data sources, extracts, and a final exit node, with auth-token fan-out and join-on-key. Drag nodes, draw edges, configure them in the inspector, click Run, and watch the executor walk the graph.

## What it models

The visible story: an Auth API node fetches a token, an Extract coerces that token into a single-item collection, and the collection fans out as an authorization header to three downstream API calls (Products, Inventory, Reviews). Each of those is then Extracted into a flat row collection and joined on a shared key (`sku`) at an Exit node. The executor topologically sorts the graph from the React Flow edges, runs each node in order, animates the edges as data flows, and surfaces per-node stats and the raw API envelope in the inspector.

Layered on top of that, the sandbox now reflects four concepts from the current production architecture (post PR #10620 / #10651):

- **Single-terminal-node validation** — a banner above the canvas reports whether the graph has exactly one terminal node (a node with no outgoing edges), matching production's publish-time gate. It's informational here, not enforced — the sandbox's whole point is exploration.
- **Preview-derived outputs** — the inspector shows `Object.keys(collection[0])` with inferred types per Extract/Exit node, mirroring how production now derives a node's output schema from the preview shape rather than declared `outputMappings`.
- **Carry-forward annotation** — Extract nodes with upstream-of-upstream context (e.g. the auth token) display a `carries:` row listing the upstream aliases, mirroring production's default behavior of merging upstream rows into every node's output.
- **Derived input mappings** — the inspector renders the `inputMappings` array (`{ alias, column }` pairs) that production would store on each node, derived from the current edges. When an upstream collection has exactly one key, the `column` is populated; otherwise it falls back to `"*"` ("all keys carried forward").

## What it intentionally does NOT model

These are deliberate scope cuts to keep the sandbox a clear pedagogical tool rather than a 1:1 mirror of production:

- **Edges remain the source of truth.** Production has shifted to deriving the DAG from each node's `inputMappings` (paths of the form `<alias>.<column>`), so React Flow visual edges are now decorative on the package-builder side. In this sandbox, edges still drive the executor's topological sort — the visual story (drag an edge, watch data flow) is the whole point. The "Derived input mappings" panel is the bridge between the two mental models.
- **No `PlanNodeInput` discriminated union.** Production models inputs as a discriminated union with per-variant fields (`literal{value}` / `runtime{key}` / `upstream{alias, column}`). The sandbox uses simple per-node `config` objects (URL or pasted JSON for sources, `collectionPath` for extracts, `joinKey` for exit). Adding the discriminated union would obscure the visual flow without adding pedagogical value here.
- **No contributor pattern or node-kind discriminator.** Production uses a contributor pattern that lets node kinds (DataSource / Extract / future Filter, Transform, Join) register themselves with the engine. The sandbox hardcodes the three node kinds in the executor's `if/else if` ladder. Different scope, different goals.
- **No `AsyncIterable<Row>` runners.** Production runners return `AsyncIterable<Row>` and the engine collects them with `for await`. The sandbox runners return whole collections synchronously after `await`. The async iterator shape matters in production for memory/streaming; in a 95-row mock dataset it would be invisible.

## Running it

```sh
npm install
npm run dev    # vite dev server, hot reload
npm run build  # production build to dist/
```

Deployed automatically to GitHub Pages from the `master` branch via `.github/workflows/deploy.yml`.

## Layout

```
src/
  main.jsx                      # React entry
  App.jsx                       # ReactFlow canvas + initial graph + validation/carries derivation
  App.css
  engine/
    executor.js                 # topo-sort + node handlers + edge animation
  nodes/
    FlowNode.jsx                # custom React Flow node (datasource / extract / exit)
    FlowNode.css
  components/
    Inspector.jsx               # right-side panel: config + stats + derived panels + raw response
    Inspector.css
    GlobalsPanel.jsx            # left-side panel: graph-wide stats
    GlobalsPanel.css
  mocks/
    sources.js                  # mock API responses for the four data source nodes
```
