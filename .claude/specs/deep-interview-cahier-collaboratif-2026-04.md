---
subject: Cahier - Éditeur WYSIWYG collaboratif temps réel pour groupes projet
type: brownfield
rounds: 13
ambiguity: 13%
created: 2026-04-13
---

# Spécification : Cahier (Notebook collaboratif)

## Scores de clarté
| Dimension | Score | Poids | Contribution |
|-----------|-------|-------|-------------|
| Objectif | 0.95 | 35% | 33.25% |
| Contraintes | 0.80 | 25% | 20.00% |
| Critères de succès | 0.80 | 25% | 20.00% |
| Contexte technique | 0.90 | 15% | 13.50% |
| **Clarté totale** | | | **86.75%** |

## Objectif

Permettre aux groupes projet CESI (3-5 étudiants) de rédiger ensemble en temps réel des documents riches directement dans Cursus, sans quitter l'application pour Google Docs. Le **Cahier** est un éditeur WYSIWYG collaboratif de type Notion, intégré au canal du projet à côté des documents existants.

## Contraintes

- **Serveur** : Express + SQLite uniquement, dev solo. Pas de Redis, pas de micro-services.
- **Sync** : Yjs (CRDT) via WebSocket Socket.IO existant. Provider custom y-websocket sur Socket.IO.
- **Éditeur** : TipTap (ProseMirror) + y-prosemirror pour la collaboration. WYSIWYG par défaut.
- **Bundle** : ~80Ko gzip pour TipTap + Yjs. Acceptable pour un éditeur riche.
- **Sessions** : 3-5 utilisateurs simultanés max par cahier. Pas de scaling "100 users".
- **Stockage** : Yjs document state serialisé en BLOB dans SQLite. Snapshot à chaque déconnexion + interval 30s.
- **Scope MVP** : Éditeur WYSIWYG collab + curseurs colorés + sauvegarde auto. Rien d'autre.

## Non-objectifs (hors scope v1)

- Historique des versions / attribution des contributions (v2)
- Export PDF/DOCX (v2)
- Review/annotation de fichiers externes (v2)
- Co-édition de code avec exécution (v2+)
- Intégration avec les devoirs (dépôt direct depuis un cahier) (v2)
- Mode source Markdown (v2 - power users)
- Modèle de permissions par cahier (v1 : tout le groupe peut éditer)
- Analytics/métriques d'usage (pas prévu, confiance dans le design)

## Critères d'acceptation

- [ ] Un groupe peut créer un cahier depuis la vue canal/projet
- [ ] Le cahier apparaît dans le canal à côté des documents
- [ ] 3-5 étudiants peuvent écrire simultanément dans le même cahier
- [ ] Éditeur WYSIWYG : gras, italique, titres, listes, liens, images inline, blocs de code
- [ ] Chaque utilisateur a un curseur coloré avec son nom
- [ ] La sauvegarde est automatique et silencieuse (pas de bouton "sauvegarder")
- [ ] Le cahier persiste entre les sessions (stocké en SQLite via Yjs)
- [ ] Le prof peut lire les cahiers de ses groupes (lecture seule)
- [ ] La latence de sync est < 500ms sur réseau local
- [ ] L'app reste fonctionnelle si un utilisateur se déconnecte en pleine édition
- [ ] La création d'un cahier est intuitive (1-2 clics max)
- [ ] Les groupes utilisent spontanément les cahiers sans intervention du prof

## Hypothèses exposées et résolues

| Hypothèse | Challenge | Résolution |
|-----------|-----------|-----------|
| Co-édition = Google Docs | "C'est 6+ mois de dev pour un seul dev" | Scope réduit : WYSIWYG Markdown uniquement, Yjs CRDT, 3-5 users max |
| CodeMirror suffit | "Les étudiants non-tech ne connaissent pas Markdown" | TipTap WYSIWYG type Notion : adoption > légèreté |
| Les étudiants ont besoin d'un outil complet | "Quelle est la version minimale viable ?" | Éditeur + curseurs + sauvegarde auto. Pas d'historique, pas d'export |
| Le pad doit être un module séparé | "Où vit-il dans l'UX ?" | Intégré au canal du projet, à côté des documents |
| "Pad" comme nom | "Trop technique/générique" | Renommé **Cahier** - familier, évocateur |
| Il faut des métriques de succès | "Comment mesurer ?" | Pas de tracking. Le design doit être assez bon pour que l'adoption soit naturelle |

## Architecture technique

### Nouvelles dépendances
```
yjs                   ~20Ko gzip  - CRDT engine
y-prosemirror         ~8Ko gzip   - ProseMirror binding
@tiptap/vue-3         ~30Ko gzip  - Vue 3 WYSIWYG editor
@tiptap/starter-kit   ~20Ko gzip  - Extensions de base
```

### Schéma base de données
```sql
CREATE TABLE cahiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id INTEGER NOT NULL REFERENCES promotions(id),
  group_id INTEGER REFERENCES groups(id),
  project TEXT,                          -- catégorie projet (lien avec devoirs)
  title TEXT NOT NULL DEFAULT 'Sans titre',
  yjs_state BLOB,                       -- Yjs document state (Uint8Array)
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_cahiers_promo ON cahiers(promo_id);
CREATE INDEX idx_cahiers_group ON cahiers(group_id);
```

### Architecture de sync
```
[Étudiant A - TipTap + Yjs]  ←→  [Socket.IO room: cahier:{id}]  ←→  [Étudiant B - TipTap + Yjs]
                                           ↓
                                 [y-websocket adapter]
                                           ↓
                                 [SQLite: yjs_state BLOB]
                                 (snapshot every 30s + on disconnect)
```

### Fichiers à créer
- `server/db/models/cahiers.js` — Queries CRUD + Yjs state
- `server/routes/cahiers.js` — REST API (list, create, delete, rename)
- `src/main/ipc/cahiers.js` — IPC handlers Electron
- `src/renderer/src/stores/cahier.ts` — Pinia store
- `src/renderer/src/composables/useCahierCollab.ts` — Yjs + awareness + TipTap setup
- `src/renderer/src/components/cahier/CahierEditor.vue` — Éditeur principal
- `src/renderer/src/components/cahier/CahierList.vue` — Liste des cahiers dans le canal
- `src/renderer/src/components/cahier/CahierCursors.vue` — Affichage curseurs collaborateurs

### Fichiers existants à modifier
- `server/db/schema.js` — Ajouter table cahiers
- `server/app.ts` — Ajouter Socket.IO namespace pour Yjs sync
- `src/renderer/src/views/DocumentsView.vue` — Ajouter onglet/section Cahiers
- `src/renderer/src/router/index.ts` — Optionnel : route dédiée cahier/:id

## Transcription

<details><summary>Voir les Q&R (13 rounds)</summary>

**Round 1** — Vision : Feature différenciante (pas juste combler un manque)

**Round 2** — Levier : Collaboration temps réel (au-delà du chat existant)

**Round 3** — Contexte : Travail de groupe asynchrone avec moments de sync live

**Round 4** — Manque clé : Partage de documents live (force les étudiants à quitter Cursus pour Google Docs)

**Round 5** — Scope : Co-édition Markdown + Live file review

**Round 6** — Contrainte : Complexité serveur (Express + SQLite, dev solo)

**Round 7** — MVP : Juste l'éditeur collab (curseurs + preview + sauvegarde auto)

**Round 8** — Critère de succès : Création spontanée de cahiers (adoption organique)

**Round 9** — UX : Intégré dans le canal à côté des documents

**Round 10** — Nom : Cahier (Notebook)

**Round 11** — Éditeur UX : WYSIWYG léger type Notion (pas de Markdown brut)

**Round 12** — Stack : TipTap/ProseMirror (adoption > légèreté)

**Round 13** — Métriques : Pas de tracking, confiance dans le design

</details>
