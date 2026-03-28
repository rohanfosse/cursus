---
name: widget-sizing-system
status: in-progress
created: 2026-03-28T19:39:02Z
progress: 0%
prd: .claude/prds/widget-sizing-system.md
github: https://github.com/rohanfosse/cursus/issues/43
---

# Epic: widget-sizing-system

## Overview

Transformer les dashboards etudiant et prof de Cursus en un systeme de widgets multi-tailles inspire d'Android, avec picker visuel et presets de layout. Actuellement, tous les widgets sont 1x1 dans une grille 2 colonnes fixe. L'objectif est une grille 4 colonnes CSS Grid avec 4 tailles (1x1, 2x1, 2x2, 4x1), resize utilisateur, et decouverte par categories.

## Architecture Decisions

1. **CSS Grid natif** (pas de lib externe) : `repeat(4, 1fr)` avec `grid-auto-flow: dense` pour le placement automatique. Les widgets utilisent `grid-column: span N` / `grid-row: span N`.

2. **Registry unifie** : etendre `WidgetDef` avec `sizes`, `defaultSize`, `category`, `role` pour partager la meme interface entre etudiant et prof.

3. **Preferences etendues** : ajouter `sizes: Record<string, WidgetSize>` au schema `BentoPrefs` existant, avec migration automatique des anciennes preferences.

4. **Composant widget wrapper** : nouveau `<WidgetShell>` qui gere la taille CSS Grid, le mode edit (poignees resize), et le contenu adaptatif via slot + prop `currentSize`.

5. **Presets comme data** : les presets sont des objets `BentoPrefs` statiques exportes depuis un fichier de config, pas de logique complexe.

## Technical Approach

### Frontend Components

| Composant | Action | Fichier |
| --------- | ------ | ------- |
| `WidgetShell.vue` | NOUVEAU - wrapper grid + resize UI | `src/renderer/src/components/dashboard/WidgetShell.vue` |
| `WidgetPicker.vue` | NOUVEAU - picker visuel par categorie | `src/renderer/src/components/dashboard/WidgetPicker.vue` |
| `StudentBento.vue` | MODIFIER - grille 4 cols + WidgetShell | existant |
| `TabAccueil.vue` | MODIFIER - grille 4 cols + WidgetShell | existant |
| `BentoCustomizer.vue` | REMPLACER par WidgetPicker | existant |
| `registry.ts` (student) | ETENDRE - sizes, category, role | existant |
| `useTeacherBento.ts` | ETENDRE - TeacherTileDef → WidgetDef | existant |

### Composables

| Composable | Action | Fichier |
| ---------- | ------ | ------- |
| `useBentoPrefs.ts` | MODIFIER - ajouter sizes, preset, migration | existant |
| `useTeacherBento.ts` | MODIFIER - aligner sur WidgetDef, ajouter sizes | existant |
| `useWidgetGrid.ts` | NOUVEAU - logique grille responsive + breakpoints | nouveau |
| `useWidgetPresets.ts` | NOUVEAU - presets data + apply/reset | nouveau |

### Types

```typescript
// Dans types/index.ts ou un fichier dedie
type WidgetSize = '1x1' | '2x1' | '2x2' | '4x1'

interface WidgetDef {
  id: string
  label: string
  icon: Component
  description: string
  category: 'essential' | 'communication' | 'tracking' | 'productivity' | 'fun'
  sizes: WidgetSize[]
  defaultSize: WidgetSize
  defaultEnabled: boolean
  role: 'student' | 'teacher' | 'both'
}
```

## Implementation Strategy

**Phase 1 — Fondations (tasks 1-3)** : Types, registry, preferences. Pas de changement visuel.

**Phase 2 — Grille + Shell (tasks 4-5)** : WidgetShell, grille 4 cols, responsive. Les widgets existants s'affichent dans la nouvelle grille avec leur taille par defaut.

**Phase 3 — Resize + Picker (tasks 6-7)** : UI de resize en mode edit, widget picker visuel par categorie.

**Phase 4 — Presets + Polish (tasks 8-9)** : Presets de layout, migration preferences, tests.

## Task Breakdown Preview

1. Definir types WidgetSize + etendre WidgetDef (types, registry)
2. Etendre useBentoPrefs + useTeacherBento (persistence tailles + migration)
3. Creer useWidgetGrid (logique responsive 4/2/1 colonnes)
4. Creer WidgetShell.vue (wrapper grid-column/grid-row + slot adaptatif)
5. Migrer StudentBento.vue vers grille 4 colonnes + WidgetShell
6. Migrer TabAccueil.vue + TeacherWidgets.vue vers grille 4 colonnes
7. Creer WidgetPicker.vue (picker visuel par categorie, remplace BentoCustomizer)
8. Creer useWidgetPresets.ts + UI de selection de preset
9. Ajouter le resize interactif en mode edit (menu contextuel par widget)
10. Tests + verification responsive + migration preferences

## Dependencies

- `vue-draggable-plus` (existant) pour le drag-and-drop
- CSS Grid natif (aucune lib)
- Tasks 1-3 parallelisables
- Tasks 5-6 parallelisables (etudiant / prof independants)
- Task 7 depend de 4 (WidgetShell)
- Task 9 depend de 4+7

## Success Criteria (Technical)

- Grille 4 colonnes avec breakpoints 1024/600px
- Chaque widget supporte au moins 2 tailles
- Preferences migrees sans perte depuis l'ancien format
- Widget picker affiche categories + previews
- 3+ presets par role (etudiant/prof)
- Zero regression sur les 359 tests existants
- TypeScript strict (pas de `any`)

## Estimated Effort

- **Phase 1** (fondations) : ~2h
- **Phase 2** (grille + shell) : ~4h
- **Phase 3** (resize + picker) : ~4h
- **Phase 4** (presets + polish) : ~3h
- **Total** : ~13h de dev, decoupable en 4 sessions

## Tasks Created

- [ ] 001.md - Types WidgetSize et WidgetDef etendu (parallel: true)
- [ ] 002.md - Etendre les registries widgets etudiant + prof (parallel: true, depends: 001)
- [ ] 003.md - Etendre useBentoPrefs et useTeacherBento (parallel: true, depends: 001)
- [ ] 004.md - Creer useWidgetGrid logique responsive (parallel: true, depends: 001)
- [ ] 005.md - Creer WidgetShell.vue wrapper grille (depends: 001, 004)
- [ ] 006.md - Migrer StudentBento.vue vers grille 4 colonnes (depends: 002, 003, 005)
- [ ] 007.md - Migrer TabAccueil + TeacherWidgets vers grille 4 colonnes (depends: 002, 003, 005)
- [ ] 008.md - Creer WidgetPicker visuel par categorie (depends: 002, 005)
- [ ] 009.md - Presets de layout + UI de selection (depends: 003, 006, 007)
- [ ] 010.md - Resize interactif en mode edit (depends: 005, 006, 007)

Total tasks: 10
Parallel tasks: 4 (001-004 en parallele)
Sequential tasks: 6
Estimated total effort: 14.5 hours
