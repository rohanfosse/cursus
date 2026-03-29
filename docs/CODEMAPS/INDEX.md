<!-- Generated: 2026-03-29 | Cursus v2.0.4 | Token estimate: ~150 -->

# Cursus Codemaps Index

Quick navigation to architecture documentation for Cursus — Electron + Express + Vue 3 + SQLite educational platform.

## Codemaps

### 1. **[architecture.md](./architecture.md)** — High-Level Overview
- Project type: Electron + Express + Vue 3 + SQLite
- Entry points: Electron, Server, Vue app
- Key architectural decisions & security perimeter
- Middleware chain overview
- Deployment strategies

**When to read**: Understanding project structure, deployment decisions, tech stack rationale.

### 2. **[backend.md](./backend.md)** — Routes & Server
- 22 route files, ~500 endpoints total
- Middleware stack (CORS, auth, rate limiting, logging)
- Authorization helpers: requirePromo, requireTeacher, etc.
- Validation schemas (Zod)
- Rate limiting & error handling

**When to read**: Adding/modifying API endpoints, understanding request flow, auth logic.

### 3. **[frontend.md](./frontend.md)** — Views, Stores & Composables
- 8 main Vue views (Dashboard, Messages, Assignments, etc.)
- 9 Pinia stores (app, messages, travaux, documents, etc.)
- 50+ composable hooks organized by feature
- Socket.io client events
- State management architecture

**When to read**: Working with Vue components, managing state, building new features.

### 4. **[data.md](./data.md)** — Database Schema
- 40+ tables (core, messaging, assignments, analytics, live sessions, projects)
- Foreign key relationships & ER diagram
- 25+ performance indexes
- Migration history (v0 → v47)
- Encryption status

**When to read**: Querying database, understanding data relationships, planning schema changes.

## Quick Reference

### By Task

| Task | Read |
|------|------|
| Add new API endpoint | backend.md (routes section) |
| Create new Vue component | frontend.md (views/composables) |
| Modify database | data.md (schema section) |
| Understand auth flow | backend.md (middleware section) + frontend.md (useApi) |
| Check API for feature X | backend.md (route table) |
| Find table for data X | data.md (tables section) |
| Modify state in Vue | frontend.md (stores section) |
| Fix performance issue | architecture.md (optimizations) + data.md (indexes) |

### By Role

| Role | Start With |
|------|-----------|
| **Backend Engineer** | backend.md → data.md |
| **Frontend Engineer** | frontend.md → backend.md (for API contracts) |
| **Full Stack** | architecture.md → all others |
| **DevOps** | architecture.md (deployment section) |
| **Database Admin** | data.md → backend.md (for query patterns) |

## Key Statistics

- **Lines of code**: ~15k frontend (Vue), ~8k backend (Express)
- **API endpoints**: ~500 across 22 route files
- **Database tables**: 40+ normalized tables
- **Composables**: 50+ reusable hooks
- **Stores**: 9 Pinia modules
- **Schema version**: v47 (latest)
- **Test coverage**: 80%+ (unit + integration + e2e)

## Key Technologies

| Component | Stack |
|-----------|-------|
| Desktop | Electron 29, electron-vite, electron-updater |
| Web | Vite 6, Vue 3, Vue Router 4 |
| State | Pinia 2 |
| Server | Express 4, Socket.io 4, jwt, bcryptjs |
| Database | SQLite, better-sqlite3 |
| Validation | Zod 4 |
| Testing | Vitest, Playwright, Supertest |
| Styling | Lucide icons, CSS custom properties |

## Important Notes

1. **Monolithic but modular**: Single codebase, separable Electron (desktop) and web deployments
2. **Async tracking**: Session/visit tracking is non-blocking (doesn't delay responses)
3. **Realtime features**: Socket.io for presence, typing, live quizzes, REX feedback
4. **French-first UI**: All user-facing strings in French, codebase comments mix French/English
5. **No external services**: SQLite for DB, no external API, error reporting is internal
6. **Security-conscious**: Rate limiting, JWT validation, password hashing (bcrypt), content security policy

## File Locations

```
docs/CODEMAPS/
├── INDEX.md           ← You are here
├── architecture.md    ← High-level overview
├── backend.md         ← Routes, middleware, auth
├── frontend.md        ← Views, stores, composables
└── data.md            ← Database schema, tables, relationships
```

## Last Updated
**2026-03-29** | Cursus v2.0.4 | Generated from actual source code

---

**For detailed exploration**, start with the relevant codemap above. Each is optimized for ~500 tokens (AI context consumption).
