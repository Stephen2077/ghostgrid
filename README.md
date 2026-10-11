# GhostGrid

**Build your city. Command your agents.**

A cyberpunk 3D pixel-art city where every building is an AI agent. Type a command, watch a drone fly from the Router Spire to Codex Tower, approve a risky action at the Security Checkpoint, and get the result back. Build more agents or your own bots (e.g. a trading bot) on empty lots. A dashboard shows usage as city resources.

AI Engineer NYC Hackathon (MLH) · 2026-10-11

## Repo layout

| Folder | What | Owner |
|---|---|---|
| `frontend/` | React + Vite + TypeScript + Three.js (React Three Fiber) city and dashboard. Uses mock data until the backend is ready. | Stephen |
| `backend/` | Agent orchestrator API (coming) | teammate |

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Demo script and architecture: [`frontend/README.md`](frontend/README.md).

## Backend contract

The frontend calls the backend only through `frontend/src/api/client.ts`. Each function currently returns mock data from `frontend/src/api/mock.ts`. Replace the bodies with real requests and keep the return types in `frontend/src/types.ts`. Player-built bots carry a `bot.endpoint` URL for the backend to connect.
