# GhostGrid

**Build your city. Command your agents.**

A cyberpunk pixel city that visualizes AI agents at work. Every building is an agent. Type a command, watch a drone fly from the Router Spire to Codex Tower, approve a risky action at the Security Checkpoint, and get the result back. A second page (`/console`) is an API-platform style console: agents, request logs, usage, API keys, playground.

Frontend only. The backend is mocked behind one file, so the real API can be dropped in later.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. If `vite` hangs in a sandboxed shell, use `node scripts/dev.mjs` (same server through the Vite JS API).

## Demo script (60 seconds)

1. `/console/keys` → **Add API key** (e.g. DeepSeek). Grey "NO KEY" buildings light up.
2. City → type `Clean the build and rebuild` → Enter.
3. Drone flies Router Spire → Codex Tower (1.5 s). Codex works (4 s, green terminal windows).
4. Security Checkpoint shows a yellow `!` and asks: *Codex wants to delete /tmp/build. Approve?*
5. **Approve (Y)** → drone returns with a glowing data cube → result card. **Reject (N)** → checkpoint goes red.
6. Click any building → side panel with status, last 5 logs, key/model selector.
7. `/console/logs` shows every call the city just made. `/console/playground` streams a reply and lights up that building.

## Stack

React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · zustand · Framer Motion · Recharts · [Shaders](https://github.com/shader-effects-inc/shaders) (WebGPU sky, CSS fallback when WebGPU is missing).

## Where things live

| Path | What |
|---|---|
| `src/store/grid.ts` | City state machine: `runCommand → dispatch → working → approval → done/rejected` |
| `src/store/keys.ts` | Provider keys + per-building key/model (localStorage, demo only) |
| `src/api/client.ts` | **Only** entry point for backend calls. Swap mock calls for `fetch` here. |
| `src/api/mock.ts` | Mock backend (`submitCommand`, `approve`, `reject`, `getLogs`, `listAgents`, `listRequests`, `getUsage`, keys, `runPlayground`) |
| `src/city/*` | City page: sky shader, skyline, buildings, drones, command bar, approval dialog, side panel |
| `src/console/*` | Console layout and pages |
| `DESIGN.md` | Palette, type, pixel grid, motion rules |

## For the backend team

`api.*` in `src/api/client.ts` already receives the building's provider, base URL, key and model through `getApiConfig(buildingId)`. Replace each mock call with a real request and keep the return types from `src/types.ts`; the UI does not need to change.

Keys are stored only in the browser's localStorage. Do not use production keys in the demo.
