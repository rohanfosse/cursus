<!-- Generated: 2026-04-09 | Cursus v2.31.0 | Token estimate: ~560 -->

# Frontend Views, Stores & Composables

## Views (9 main routes)

| View File | Route | Purpose | Role |
|-----------|-------|---------|------|
| `DashboardView.vue` | `/` | Home + quick stats + widgets | both |
| `MessagesView.vue` | `/messages` | Channel chat + DM inbox | both |
| `DevoirsView.vue` | `/assignments` | Travaux (homework/projects) list + details | both |
| `FilesView.vue` | `/files` | Shared documents + uploads | both |
| `DocumentsView.vue` | `/documents` | Project-scoped document library | both |
| `AgendaView.vue` | `/agenda` | Calendar + schedule view | both |
| `LiveView.vue` | `/live` | Live quiz sessions (QCM, polls, word clouds) | both |
| `RexView.vue` | `/rex` | REX feedback sessions (async-compatible) | both |
| `LumenView.vue` | `/lumen` | Cours markdown publies, editeur teacher + reader etudiant, avec code examples et notes privees | both |

## Stores (10 total, Pinia)

| Store | Key State | Key Actions | Purpose |
|-------|-----------|-------------|---------|
| `app.ts` | user, promo, notifications | login, logout, fetchPromos, setNotification | Auth state, user profile, active promo |
| `messages.ts` | channels, messages, dms, threads | fetchMessages, sendMessage, editMessage, deleteMessage, reaction | Chat + messaging |
| `travaux.ts` | assignments, filters, view | fetchAssignments, createAssignment, updateAssignment, getGantt | Assignment management |
| `documents.ts` | docs, activeProject, filter | fetchDocuments, uploadFile, deleteFile, filterByProject | Document library |
| `agenda.ts` | events, selectedDate, view | fetchEvents, createEvent, updateEvent, syncCalendar | Calendar + scheduling |
| `live.ts` | sessions, activities, responses, scores | joinSession, submitAnswer, closeActivity, getLeaderboard | Live quiz state |
| `rex.ts` | sessions, activities, responses, analytics | createSession, submitResponse, getAnalytics, exportResults | REX feedback |
| `kanban.ts` | cards, columns, filter | fetchCards, createCard, updateCard, moveCard | Kanban task board |
| `modals.ts` | open, type, data, callback | openModal, closeModal, confirmAction | Modal manager (global) |
| `lumen.ts` | courses, currentCourse, unreadCourses, snapshotTrees, fileContentCache, notesCache, notedCourseIds, readCounts | fetchCoursesForPromo, createCourse, publishCourse, markAllAsRead, fetchSnapshotTree, fetchFileContent, refreshSnapshot, fetchCourseNote, saveCourseNote, fetchReadCounts | Cours Lumen, snapshot repo git, notes etudiant privees |

## Composables (50+, organized by feature)

### Core/API
- `useApi.ts` — HTTP client wrapper + auto retry + error handling
- `useOfflineCache.ts` — LocalStorage cache + sync queue
- `useActionCenter.ts` — Toast + notification manager

### Messaging
- `useMsgSend.ts` — Message composition + validation
- `useMsgAttachment.ts` — File upload in messages
- `useMsgAutocomplete.ts` — @mention + emoji autocomplete
- `useMsgDraft.ts` — Draft recovery + auto-save
- `useMsgFormatting.ts` — Markdown + mentions + links parsing

### UI Components (Bubbles = message interactions)
- `useBubbleActions.ts` — Context menu (pin, react, delete)
- `useBubbleMenu.ts` — Message hover menu
- `useBubbleReactions.ts` — Emoji picker + reaction count
- `useBubbleBookmarks.ts` — Save/bookmark messages

### Dashboard
- `useDashboardStudent.ts` — Student dashboard widgets (upcoming, recent)
- `useDashboardTeacher.ts` — Teacher dashboard (pending grading, new messages)
- `useDashboardWidgets.ts` — Widget grid + drag-drop customization
- `useMultiPromo.ts` — Multi-promo metrics: gantt + rendus par promo, upcoming deadlines, toGrade count

### Assignments
- `useDevoirsStudent.ts` — Student view: filter, sort, submit
- `useDevoirsTeacher.ts` — Teacher view: grading, feedback, rubrics, gantt, rendus
- `useDevoirContextMenu.ts` — Travail context menu (edit, delete, publish)

### Devoir Modal Sub-Components (v2.5.0)

- `modals/devoir/DevoirMetaSection.vue` — Status (incl. "Programme"), badges, deadline, progress
- `modals/devoir/DevoirRendusList.vue` — Unified submissions list (submitted + pending), grade distribution
- `modals/devoir/DevoirReminderBuilder.vue` — Modular reminder message composer

### Dashboard Widgets (v2.5.0)

- `dashboard/MultiPromoCard.vue` — Vue multi-promo: metriques par promo, deadlines top 3, navigation cross-promo

### Documents
- `useDocumentsData.ts` — Fetch + cache documents
- `useDocumentsAdd.ts` — Upload + create document
- `useDocumentsEdit.ts` — Rename + delete + move

### Grading & Assessment
- `useTeacherGrading.ts` — Rubric scoring + feedback
- `useBatchGrading.ts` — Notation en lot: split view, keyboard nav (A/B/C/D), auto-save, filters
- `useStudentDeposit.ts` — Submit assignment
- `useSignature.ts` — Digital signature workflow

### Settings
- `useSettingsAppearance.ts` — Theme + dark mode
- `useSettingsPreferences.ts` — App preferences (sidebar, notifications)
- `useSettingsAccount.ts` — Password change, profile edit
- `usePrefs.ts` — LocalStorage key-value preferences

### Sidebar
- `useSidebarNav.ts` — Main nav (home, messages, assignments, etc)
- `useSidebarData.ts` — Sidebar state (collapsed, search)
- `useSidebarProjects.ts` — Project list in sidebar
- `useSidebarDm.ts` — DM list + search

### Analytics & Teacher Tools
- `useTeacherAnalytics.ts` — Engagement charts + metrics
- `useTeacherBento.ts` — Bento grid layout for dashboard
- `useStudentBadges.ts` — Achievement badges
- `useStudentReminders.ts` — Deadline notifications
- `useWidgetGrid.ts` — Widget grid management
- `useWidgetPresets.ts` — Preset dashboard layouts

### Live & REX
- `useClockTimer.ts` — Countdown timer for activities
- `useRealtimeClock.ts` — Real-time clock display

### Utilities
- `usePermissions.ts` — Check user role (student, teacher, admin)
- `useDebounce.ts` — Debounce hook
- `useFocusTrap.ts` — Modal focus management
- `useFocusTrap.ts` — Modal focus trap
- `useFileDrop.ts` — Drag-drop file upload
- `useConfirm.ts` — Confirmation dialog
- `useToast.ts` — Toast notifications
- `useOpenExternal.ts` — Open URLs in default browser
- `useSwipeNav.ts` — Mobile swipe navigation
- `useFrise.ts` — Timeline/frise component logic
- `useModules.ts` — Module/bloc loading

## Socket.io Events (Client)

| Event | Payload | Direction |
|-------|---------|-----------|
| `user-status` | { userId, status: 'online'|'offline' } | emit |
| `message` | { id, content, author, channelId } | on |
| `message-edited` | { messageId, newContent } | on |
| `message-deleted` | { messageId } | on |
| `typing` | { userId, channelId, isTyping } | emit/on |
| `reaction-added` | { messageId, emoji, userId } | on |
| `live-activity-update` | { sessionId, activityId, status } | on |
| `rex-response` | { sessionId, activityId, response } | emit |
| `kanban-update` | { cardId, status, position } | emit/on |

## Data Flow Patterns

```
User Action
  ↓
Composable Hook (useApi, useMsgSend, etc)
  ↓
Call Store Action (messages.sendMessage)
  ↓
HTTP POST + error handling
  ↓
Update Pinia state (optimistic + server sync)
  ↓
Socket.io broadcast to other clients
  ↓
Component re-render (reactivity)
```

## State Management Layers

1. **Pinia stores** — App state (user, messages, assignments, etc)
2. **LocalStorage** — User preferences (theme, layout, drafts)
3. **IndexedDB** — Offline cache (messages, assignments, files)
4. **Socket.io** — Realtime updates + presence
5. **Component state** — Local UI state (collapsed, selected item)

## Performance Optimizations

- **Lazy loading**: `defineAsyncComponent()` for heavy routes
- **Memoization**: Computed properties in stores
- **Virtual scrolling**: Long message lists + file lists
- **Debounced search**: useDebounce on assignment/document search
- **Offline-first**: useOfflineCache syncs when online
- **Socket.io rooms**: Per-channel to avoid broadcast spam

## Accessibility

- Focus trap on modals (useFocusTrap)
- ARIA labels on buttons
- Keyboard navigation (arrow keys, Enter, Escape)
- Touch targets >= 44px (mobile-friendly)
- Contrast ratios meet WCAG AA (per memory: Phase 8)

## Lumen Components (`components/lumen/`)

Composants dedies au module Lumen (cours markdown avec code examples et notes).

| Composant | Role | Notes |
|-----------|------|-------|
| `LumenEditor.vue` | Editeur CodeMirror 6 pour le contenu markdown | Drop images et .md supporte |
| `LumenToolbar.vue` | Toolbar markdown (h1/h2/bold/italic/code/list) | Emet events au parent |
| `LumenPreview.vue` | Preview scrollable du rendu markdown live | Sync scroll avec l'editeur |
| `LumenOutline.vue` | Plan du cours extrait des headings h1-h6 | Click → scrollToLine |
| `LumenStatusBar.vue` | Barre d'etat bas : stats + raccourcis | Teacher uniquement |
| `LumenCommandPalette.vue` | Palette Ctrl+K pour actions rapides | Teacher uniquement |
| `LumenReader.vue` | Vue lecture etudiant : TOC sticky, progress bar, prev/next, restauration scroll | Alt+arrows nav, scroll persiste dans localStorage |
| `LumenProjectPanel.vue` | Container projet d'exemple (tree + viewer + download) | Auto-select README.md, prop initialFile pour deep link |
| `LumenProjectTree.vue` | Arborescence expandable avec fuzzy search Ctrl+P | Navigation clavier complete, expand/collapse all |
| `LumenProjectFileViewer.vue` | Viewer single-file avec hljs, rendu md auto, Ctrl+F search | Breadcrumb + line count + copy + markdown toggle |
| `LumenNotePanel.vue` | Panneau notes privees etudiant (details repliable) | Autosave debounce 1.5s, max 10 000 chars |
| `LumenKeyboardHelp.vue` | Overlay aide clavier (ouvert via ?) | Groupes filtres selon mode actif |
