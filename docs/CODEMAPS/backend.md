<!-- Generated: 2026-04-24 | Cursus v2.241.0 | Token estimate: ~560 -->

# Backend Routes & Middleware

## Middleware Stack (in order)
1. `cors()` — CORS headers for origin
2. `express.json({ limit: '20mb' })` — Body parser
3. Security headers middleware — CSP, HSTS, X-Content-Type-Options, X-Frame-Options
4. Request logging — ms, status, slow query detection
5. Global rate limit — 300 req/min per IP (express-rate-limit)
6. JWT secret + io + jwtSecret set on app
7. **Auth routes** — `/api/auth` (20 req/min limiter)
8. **Error reporting** — `/api/report-error` (no auth)
9. **JWT auth middleware** — on `/api/*` (extract user from Bearer token)
10. Read-only mode check — blocks mutations unless teacher/ta
11. Session tracking — upsertSession (async, non-blocking)
12. Visit tracking — recordVisit on GET (async, non-blocking)
13. **Protected route handlers**
14. Global error handler

## Route Files (36 files + 2 sub-route folders)

| Route | Handlers | Purpose |
|-------|----------|---------|
| `/api/auth` | login, logout, register, changePassword, init | Auth + password resets |
| `/api/lumen` | repos (GitHub-backed), chapters, notes, reads, FTS5 search, chapter<->travaux links, visibility | Lumen v2 post-pivot GitHub : 1 promo = 1 org, manifest auto-genere, cache markdown + images |
| `/api/promotions` | list, create, update, delete, archive | Promo management |
| `/api/students` | list, get, update, delete, bulk | Student profiles + avatar |
| `/api/teachers` | list, get, update, delete, setRole | Teacher profiles + roles (admin/ta) |
| `/api/messages` | send, edit, delete, getChannelMessages, getDMs, pin, react, report | Chat + DM + reactions |
| `/api/messages/scheduled` | list, create, cancel, edit (user-scope) | Messages programmes (envoi differe) — monte avant `/api/messages` |
| `/api/assignments` | list, create, update, delete, getGantt, getSchedule, publish, schedule, mark-missing | Travaux (devoirs/soutenance/etc) + publication programmee + groupe |
| `/api/depots` | list, create, update, delete, getStudentSubmissions | Student submissions |
| `/api/groups` | list, create, update, delete, addMember, removeMember | Groupes + members |
| `/api/resources` | list, create, delete | Ressources (files/links for travaux) |
| `/api/documents` | list, create, update, delete, search | Channel documents (shared files) |
| `/api/rubrics` | get, create, update, delete, scoreSubmission | Grading rubrics |
| `/api/files` | upload (multipart), download (auth via JWT header) | File upload/download |
| `/api/admin/*` | sub-folder : audit, deploy, feedback, import, maintenance, moderation, monitor, scheduled, security, sessions, settings, settings-read, stats, users | Console admin eclatee en sous-modules (15 fichiers) |
| `/api/live` | createSession, joinSession, leaveSession, getActivity, submitAnswer, closeActivity | Live quiz legacy (conserve pour compat) |
| `/api/live-v2` | sessions + activities (spark/pulse/code/board), clone, confusion signals, replay async, self-paced | Live unifie (v61) — fusion Spark + Pulse + Code + Board dans un seul moteur |
| `/api/kanban` | getCards, createCard, updateCard, deleteCard | Task tracking |
| `/api/teacher-notes` | list, create, update, delete (per student) | Private teacher notes |
| `/api/engagement` | getUserMetrics, getClassMetrics | Engagement analytics |
| `/api/signatures` | list, createRequest, downloadFile, submitSignature, rejectSignature | Digital signatures |
| `/api/projects` | list, create, update, delete, setTeachers | Project (v42+) management |
| `/api/bookmarks` | toggle, list, import (bulk), note | Signets de messages (stockes DB, cf v79) |
| `/api/cahiers` | list, create, rename, delete, fetch Yjs state, save Yjs state (rate-limited) | Cahiers collaboratifs Yjs + TipTap (v60) |
| `/api/calendar` | /feed.ics (auth), tokens CRUD, Outlook sync (Microsoft Graph) | Feed iCal abonnement + integrations calendrier |
| `/api/games/:gameId` | scores (POST), leaderboard, me | Scores mini-jeux arcade generiques (Snake, SpaceInvaders) avec anti-triche score/sec |
| `/api/typerace` | phrases/random, scores, leaderboard, me | Mini-jeu typing FR dedie (phrases JSON, metriques wpm/accuracy) |
| `/api/link-preview` | resolve (batch), image (proxy SSRF-safe) | Unfurl liens (OpenGraph) + proxy image anti-fuite IP |
| `/api/bookings/*` | sub-folder : teacherAdmin (event-types, availability, tokens, my-bookings), oauth (MS Graph), publicBooking (/public/:token/info,slots,book), cancellation (+ reschedule + ics) | Mini-Calendly : RDV visio tuteurs entreprise (v62-v65) |
| `/api/statuses` | GET /api/me/status, PUT, DELETE, GET /api/statuses (liste active) | Statuts utilisateurs (emoji + texte + expiresAt), broadcast via Socket.io |
| `/api/update/config` | GET public | Config auto-updater (disabled, minVersion, channel, message) — public, pas de JWT |
| `/api/error-report` | report (no auth) | Frontend error logging |
| `/ical/:token.ics` | feed iCal public (no auth, token-scoped) | Abonnement Google/Outlook/Apple Calendar sans auth |
| `/download` | github releases proxy (no auth) | App updates |
| `/webhook/deploy` | validates DEPLOY_SECRET | GitHub deployment webhook — ecrit un fichier signal dans /deploy-signal |

## Key Route Patterns

```javascript
// Standard middleware chain on protected routes:
router.get('/:id',
  requirePromo(promoFromTravail),      // Check promo access
  wrap((req) => queries.getTravailById(Number(req.params.id)))
)

// Teacher-only with validation:
router.post('/',
  requireTeacher,                      // User must be teacher
  validate(createAssignmentSchema),    // Zod schema validation
  wrap((req) => queries.createTravail(req.body))
)

// Async non-blocking (session/visit tracking):
app.use('/api', (req, _res, next) => {
  if (req.user && req.headers.authorization) {
    try {
      upsertSession({...})  // Async, doesn't block response
    } catch (err) { log.warn(...) }
  }
  next()
})
```

## Authorization Middleware

| Function | Checks | Returns |
|----------|--------|---------|
| `requirePromo(fn)` | User has access to promo (from req.query.promoId or via fn) | next() or 403 |
| `requireTeacher` | User type === 'teacher' or 'ta' or 'admin' | next() or 403 |
| `requireMessageOwner` | Message author is current user | next() or 403 |
| `requireDmParticipant` | User is DM recipient or sender | next() or 403 |
| `promoFromChannel` | Extract promo from channelId in query | Promo ID |
| `promoFromTravail` | Extract promo from travail_id in params | Promo ID |

## Validation Schemas (Zod)

**Auth**: loginSchema, registerSchema, changePasswordSchema
**Messages**: sendMessageSchema, editMessageSchema, reactionSchema
**Assignments**: createAssignmentSchema, updateAssignmentSchema
**Documents**: createDocumentSchema, updateDocumentSchema
**Live**: createSessionSchema, submitAnswerSchema
**REX**: createSessionSchema, submitResponseSchema
**Rubrics**: createRubricSchema, scoreSchema
**Signatures**: createSignatureSchema, submitSignatureSchema

## Performance Features

- **Rate limiting**: Per-endpoint (auth: 20/min, messages: 30/min, global: 300/min)
- **Caching**: None at HTTP level (realtime app, cached via Pinia on frontend)
- **Indexing**: 25+ database indexes on frequently filtered columns
- **Async**: Session/visit tracking non-blocking
- **Middleware wrap()**: Automatic error handling + response formatting
- **Request logging**: 1000ms+ logged as slow_request

## Error Handling

- **Validation errors** (400): Zod parse failures
- **Auth errors** (401): Missing/invalid JWT token
- **Permission errors** (403): Insufficient role or promo access
- **Not found** (404): Resource doesn't exist
- **Rate limit** (429): Too many requests
- **Server errors** (500): Unhandled exceptions, logged with full stack in dev mode only
