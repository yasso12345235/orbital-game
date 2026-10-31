# ORBITAL Server

Backend for Mission Architect: user auth (JWT), cloud saves, and global leaderboards.

## Stack

- Node 18+ / TypeScript
- Express 4
- sql.js (SQLite in WASM — zero native build tools, works on any platform)
- bcryptjs + jsonwebtoken (auth)
- Zod (validation)

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Service health |
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Get JWT access token |
| GET | `/api/saves` | Yes | List user's cloud saves |
| GET | `/api/saves/:id` | Yes | Get one save (owner only) |
| POST | `/api/saves` | Yes | Create a save |
| PUT | `/api/saves/:id` | Yes | Replace a save (owner only) |
| DELETE | `/api/saves/:id` | Yes | Delete a save (owner only) |
| POST | `/api/leaderboard/:missionId/score` | Yes | Submit a mission score |
| GET | `/api/leaderboard/:missionId` | No | Top scores for a mission (paginated) |

## Frontend client

`src/game/api.ts` provides `apiRegister`, `apiLogin`, `apiListSaves`, `apiCreateSave`, `apiUpdateSave`, `apiDeleteSave`, `apiSubmitScore`, `apiGetLeaderboard`, and `apiHealth`. Call `api.setAuthToken(token)` after login so subsequent requests include the Bearer token.

## Scripts

- `npm run dev` — start with `tsx watch` (hot reload)
- `npm run build` — TypeScript compile to `dist/`
- `npm start` — run `dist/index.js`
- `npm run typecheck` — `tsc --noEmit`

From the repo root: `npm run server:dev`.

## Data

SQLite file at `server/data/orbital.db` (created on first boot). Tables: `users`, `saves`, `scores`.

## Security notes

- JWT secret defaults to `dev-secret-change-me` — set `ORBITAL_JWT_SECRET` in production.
- CORS allows all origins by default — set `ORBITAL_CORS_ORIGIN` to restrict.
- Save payloads are stored as opaque JSON; the backend does not validate game schema.
