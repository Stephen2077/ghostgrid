# GhostGrid — frontend

**Build your city. Command your agents.**

A cyberpunk 3D pixel-art city where every building is an AI agent. Type a command, watch a drone fly from the Router Spire to Codex Tower, approve a risky action at the Security Checkpoint, and get the result back. Build more agents (Codex, Claude, DeepSeek) or your own bots (e.g. a trading bot) on empty lots. A dashboard shows usage as city resources.

Frontend only. All data is mocked behind one file (`src/api/client.ts`), so the backend can be dropped in without touching the UI.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. If `vite` hangs in a sandboxed shell, run `node scripts/dev.mjs` instead (same server through the Vite JS API).

## Demo script (90 seconds)

1. **Dashboard → API Keys → Add API key** (any provider; the key stays in this browser). The grey "NO KEY" buildings light up.
2. **City** → type `Clean the build and rebuild` → Enter.
3. The Router Spire turns green, a drone flies to Codex Tower (1.5 s), Codex works for 4 s (scrolling green terminal windows).
4. A data packet flies to the Security Checkpoint, which raises a yellow `!` and asks: *Codex wants to delete /tmp/build. Approve?*
5. **Y / Approve** → the drone returns with a glowing data cube → result card, +120 credits. **N / Reject** → the checkpoint turns red and shakes.
6. Click any building → side panel: status, sessions (Codex/Claude/DeepSeek), last 5 logs, key + model.
7. **BUILD** menu (left) → Trading Bot → name it → click a glowing lot. The bot appears with a live candlestick billboard; its endpoint field is where the backend connects it.
8. Drag to orbit, scroll to zoom, `Q`/`E` rotate 90°, `R` or double-click resets the view.

## What is in the city

| Building | Role | Notes |
|---|---|---|
| Router Spire | Plans and dispatches | Rotating holographic halo, faster while working |
| Codex Tower | Writes code | One floating screen per session |
| Claude Nexus | Architecture / review | Rotating rooftop blueprint, orbiting session orbs |
| DeepSeek Forge | Batch jobs | Conveyor belt with crates, smokestacks |
| Security Checkpoint | Human approval gate | Searchlight, gate arm that lifts on approval |
| Custom bots | Player-built | Trading (candlestick billboard), webhook, scraper, custom |

Every building has 4 states: `idle` (flickering windows), `working` (scrolling green glyphs), `error` (red blink + shake), `needs_approval` (yellow `!`). Without an API key an idle building is grey.

## Rendering (Three.js via React Three Fiber)

- One WebGL canvas, orthographic 2:1 isometric camera, rendered at **1/3 resolution** and upscaled with nearest-neighbour for a crisp 8-bit look.
- Measured on a 1440×900 viewport: 480×300 render target, ~137 draw calls, ~11k triangles, 3 lights, ~1 ms CPU per frame.
- Shared geometries/materials, `InstancedMesh` for anything repeated (lamps, cars, rain, distant city, candles), animation only inside `useFrame` (no React state per frame), fake shadows instead of shadow maps, bloom only on neon.
- No WebGL → the older 2D DOM city (`src/city2d/`) is loaded instead.

## Where things live

| Path | What |
|---|---|
| `src/store/grid.ts` | City state machine (`runCommand → dispatch → working → approval → done/rejected`), buildings, sessions, build mode, credits |
| `src/store/keys.ts` | Provider keys + per-building key/model (localStorage, demo only) |
| `src/store/resources.ts` | HUD resources (energy, credits, bandwidth, trust, heat, real cost) |
| `src/api/client.ts` | **Only** entry point for backend calls |
| `src/api/mock.ts` | Mock backend |
| `src/city3d/` | 3D scene: `world.ts` (map, lots), `materials.ts`, `BuildingShell.tsx`, `buildings/*`, `Ground.tsx`, `Atmosphere.tsx`, `Drones.tsx`, `CameraRig.tsx`, `Effects.tsx` |
| `src/city/` | DOM overlays: command bar, build menu, approval dialog, side panel |
| `src/console/` | Dashboard (`/dashboard`): overview, agents, activity log, API keys |
| `DESIGN.md` | Palette, type, pixel rules, motion |

## For the backend team

- Replace the mock calls in `src/api/client.ts` with real requests; keep the return types in `src/types.ts`. `getApiConfig(buildingId)` already returns the provider, base URL, key and model chosen for that building.
- Player-built bots store a `bot.endpoint` URL (`BotConfig` in `src/types.ts`). Nothing calls it yet — that is where a trading bot or webhook bot connects.
- Sessions per building live in `building.sessions` (`Session` in `src/types.ts`); push real sessions into the store when the backend reports them.

Keys are stored only in the browser's localStorage. Do not use production keys in the demo.
