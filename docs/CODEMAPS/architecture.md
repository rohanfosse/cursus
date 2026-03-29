<!-- Generated: 2026-03-29 | Cursus v2.0.4 | Token estimate: ~250 -->

# Cursus — Architecture Overview

## Project Type
**Electron + Express + Vue 3 + SQLite** — Monolithic desktop app with embedded Express server + deployable web version

## Entry Points
- **Electron**: `src/main/index.ts` — Window creation, IPC handling, auto-updater
- **Server**: `server/index.js` — Express + Socket.io, rate limiting, JWT auth, health check
- **Frontend**: `src/renderer/src/main.ts` — Vue 3 + Pinia, Socket.io client, offline cache
- **Web SPA**: `vite.web.config.ts` — Web build target (same frontend, different server origin)

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite + better-sqlite3 | Fast, embedded, no daemon, full-text search ready |
| AES-256-GCM for DM content | End-to-end encryption (future, groundwork in DB) |
| JWT + Bearer token auth | Stateless, scalable, token-per-session audit |
| Socket.io for realtime | Presence, typing, live quizzes, messaging |
| Pinia (not Vuex) | Composition API friendly, simpler patterns |
| Express.js (not Fastify) | Ecosystem, middleware maturity, better-sqlite3 support |
| Zod validation | Runtime schema validation, type inference |

## Stack Versions
- Node.js: ^18 (from .nvmrc)
- Electron: ^29.1.0
- Express: ^4.22.1
- Vue 3: ^3.5.30
- SQLite: v47 (schema version), better-sqlite3: ^12.8.0
- TypeScript: ^5.9.3

## Project Structure
```
.
├── src/
│   ├── main/              # Electron main process (IPC bridge)
│   ├── preload/           # IPC security context
│   ├── renderer/          # Vue 3 frontend
│   │   ├── src/views/     # 8 main routes
│   │   ├── src/stores/    # 9 Pinia stores
│   │   └── src/composables/ # 50+ reusable hooks
│   └── landing/           # Marketing landing page
├── server/
│   ├── index.js           # Express bootstrap + middleware chain
│   ├── routes/            # 22 route files (~500 endpoints total)
│   ├── middleware/        # auth, validate, authorize
│   ├── db/                # SQLite models, schema, queries
│   ├── services/          # scheduler, socket handler
│   ├── utils/             # logger, error handling, wrap()
│   └── public/            # admin monitoring UI
├── config/                # PM2, ecosystem config
├── resources/             # Icons, installer assets
├── docs/                  # User guides, CODEMAPS/
└── tests/                 # Vitest (unit + integration)
```

## Security Perimeter
- **Public routes**: `/api/auth`, `/api/report-error`, `/health`, `/download`
- **Protected routes**: `/api/*` (require JWT bearer token)
- **Admin routes**: `/api/admin/*` (require admin role)
- **Static files**: `/uploads` (require JWT), `/admin-monitor` (read-only)
- **Webhook**: `/webhook/deploy` (validates DEPLOY_SECRET)

## Middleware Chain
1. CORS header setup + security headers (CSP, HSTS, X-*)
2. Global rate limit (300 req/min per IP)
3. Request logging (ms, status code, slow query detection)
4. Static files (/uploads, /admin-monitor, /sw.js)
5. Auth limiter on /api/auth (20 req/min)
6. JWT auth on /api/* (extract user from token)
7. Read-only mode check (blocks POST/PUT/PATCH/DELETE unless teacher/ta)
8. Session tracking (upsertSession, async non-blocking)
9. Visit tracking (recordVisit, async non-blocking)
10. Route handlers + Socket.io
11. Global error handler

## Database
- **File**: `server/data.db` (single SQLite file)
- **Migrations**: v0→v47 via PRAGMA user_version
- **Tables**: 40+ (see data.md for schema)
- **Encryption**: none yet (groundwork for AES-256-GCM DMs)

## Realtime Features
- **Socket.io**: User presence, typing indicators, live messages
- **Live Quiz**: Teacher-led interactive sessions (QCM, polls, word clouds)
- **REX (Retour d'Expérience)**: Anonymous feedback collection (async-compatible)
- **Kanban**: Project task tracking (group collaboration)

## Deployment
- **Development**: `npm run dev` (Electron), `npm run dev:web` (Vite)
- **Production**:
  - Desktop: `npm run build:win|mac|linux` (Electron Builder)
  - Web: `npm run build:web` (Vite + SPA fallback)
  - Server: `npm run server:pm2` (PM2 + ecosystem.config.js)

## Performance Optimizations
- Better-sqlite3: synchronous, no connection pool overhead
- Async session/visit tracking: non-blocking, backgrounded
- Page visit analytics: indexed by created_at + user_id
- Message indexes: channel_id + dm_student_id + author_id for fast filtering
- Static asset caching: hashed filenames cached long, HTML never cached
