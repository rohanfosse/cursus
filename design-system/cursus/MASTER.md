# Cursus — Design System (MASTER)

> **Source de verite unique.** Toute decision visuelle/composant doit s'y referer.
> Si une page a un fichier `design-system/cursus/pages/<page>.md`, ses regles
> outrepassent ce fichier (override partiel uniquement, le reste suit MASTER).
>
> **Regle d'or** : avant d'inventer un nouveau style, chercher dans MASTER. Avant
> d'inventer un nouveau composant, chercher dans `src/renderer/src/components/ui/`.

---

**Projet** : Cursus — plateforme pedagogique CESI (Vue 3 + Electron)
**Genere** : 2026-04-11 (post v2.51.0)
**Style retenu** : **Flat Design** (SaaS / dashboard / WCAG AAA, perf excellente)
**Anti-pattern principal** : melange de variantes proches mais jamais identiques entre sections

---

## 1. Tokens de couleur

Tous les tokens vivent dans `src/renderer/src/assets/css/base.css`. **Jamais de hex
hardcode dans un composant.** Les themes (`default`, `cursus`, `marine`, `pulse`)
overrident ces variables.

### Surfaces

| Token | Defaut (dark) | Usage |
|---|---|---|
| `--bg-rail` | `#161819` | Rail de navigation gauche |
| `--bg-sidebar` | `#1c1d1f` | Sidebar de section |
| `--bg-main` | `#232425` | Zone principale, headers |
| `--bg-input` | `#1a1b1d` | Champs de saisie |
| `--bg-modal` | `#1e1f21` | Modales |
| `--bg-elevated` | `#2c2d2f` | Cartes en relief |
| `--bg-hover` | `rgba(255,255,255,.05)` | Hover universel |
| `--bg-active` | `rgba(var(--accent-rgb), .16)` | Item selectionne |

### Texte

| Token | Defaut | Contraste |
|---|---|---|
| `--text-primary` | `#E8E9EA` | AAA sur `--bg-main` |
| `--text-secondary` | `#8B8D91` | AA sur `--bg-main` |
| `--text-muted` | `#808488` | AA sur `--bg-main` (4.0:1) |

### Accent (theme-reactif)

| Token | Defaut | Usage |
|---|---|---|
| `--accent` | `#4A90D9` | Couleur primaire d'action |
| `--accent-rgb` | `74,144,217` | Pour rgba() composables |
| `--accent-hover` | `#5da3f0` | Hover |
| `--accent-light` | `#7EB8FF` | Outline focus |
| `--accent-subtle` | `rgba(var(--accent-rgb), .14)` | Backgrounds tres legers |

**Regle critique** : pour toute teinte d'accent, utiliser `rgba(var(--accent-rgb), X)`
afin que les themes propagent automatiquement.

### Semantique

| Token | Couleur | Usage |
|---|---|---|
| `--color-success` | `#2ECC71` | Etat ok, succes |
| `--color-warning` | `#E8891A` | Avertissement |
| `--color-danger` | `#E74C3C` | Erreur, suppression |
| `--color-info` | `#3B82F6` | Information neutre |
| `--color-gold` | `#E5A842` | Mention speciale |
| `--color-online` | `#27AE60` | Presence en ligne |

---

## 2. Typographie

Police unique : **Inter Variable** (`var(--font)`). Pas de police secondaire.

### Echelle (`base.css`)

| Token | Taille | Usage |
|---|---|---|
| `--text-2xs` | 10px | Badges, micro-labels |
| `--text-xs` | 11px | Helpers, captions |
| `--text-sm` | 12px | Body secondaire |
| `--font-size-base` | 14px | Body principal |
| (heading h3) | 16px | Titre de modale |
| (heading h2) | 17px | Titre d'empty state |
| (heading h1) | 18-24px | Titre de page |

### Poids

- `400` body
- `500` labels, navigation
- `600` boutons, titres
- `700` titres forts
- `800` mentions critiques (channel name)

### Letter-spacing

- Body : default
- Labels uppercase : `.08em` (uniformise dans v2.51.0)

---

## 3. Spacing

```
--space-xs:  4px
--space-sm:  8px
--space-md: 12px
--space-lg: 16px
--space-xl: 24px
```

**Toute valeur de padding/gap/margin doit utiliser un de ces tokens.** Pas de
`padding: 14px` ou `gap: 10px` qui ne suivent aucune echelle.

---

## 4. Rayons et ombres

### Rayons

| Token | Valeur | Usage |
|---|---|---|
| `--radius-sm` | 6px | Inputs, badges |
| `--radius` | 10px | Boutons, btn-icon |
| `--radius-lg` | 14px | Cartes, modales |
| `--radius-xl` | 18-20px | Hero, illustrations |

### Elevation (NOUVEAU v2.52.0)

| Token | Usage | Valeur |
|---|---|---|
| `--elevation-0` | Plat | `none` |
| `--elevation-1` | Carte au repos | `var(--shadow-card)` |
| `--elevation-2` | Carte hover, header sticky | `0 4px 16px rgba(0,0,0,.25)` |
| `--elevation-3` | Modale, popover | `0 12px 40px rgba(0,0,0,.4)` |
| `--elevation-4` | Toast, command palette | `0 24px 80px rgba(0,0,0,.55)` |

**Toute ombre doit venir d'un de ces tokens.** Plus jamais de `box-shadow` ad-hoc.

---

## 5. Motion (NOUVEAU v2.52.0)

### Durations

| Token | Valeur | Usage |
|---|---|---|
| `--motion-instant` | 0ms | Transitions desactivees (reduced-motion) |
| `--motion-fast` | 150ms | Tap, hover, focus |
| `--motion-base` | 220ms | State change, card |
| `--motion-slow` | 320ms | Modale, page transition |

### Easings

| Token | Courbe | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Entree (defaut) |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | Sortie |
| `--ease-in-out` | `cubic-bezier(.4,0,.2,1)` | Standard |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Feedback ludique |

**Regle** : exit ~70% de la duree d'entree (Material Motion). Toujours respecter
`prefers-reduced-motion`. Toute animation doit etre interruptible.

### Anciens alias (a migrer)

- `--t-fast` → equivaut a `--motion-fast`
- `--t-base` → equivaut a `--motion-base`
- `--t-slow` → equivaut a `--motion-slow`

---

## 6. Focus ring (NOUVEAU v2.52.0)

```css
--focus-ring-offset: 2px;
--focus-ring-width: 2px;
--focus-ring: 0 0 0 var(--focus-ring-offset) var(--bg-main),
              0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--accent);
```

Tous les composants interactifs doivent exposer un focus-visible utilisant
ce token. Plus de `outline: 2px solid var(--accent)` ad-hoc.

---

## 7. Composants (cible v2.53+)

Dossier cible : `src/renderer/src/components/ui/`.

### Existants

- `Modal.vue` — base modale (a etendre, beaucoup contournent encore)
- `ErrorBoundary.vue` — capture d'erreur de section
- `Toast` (composable `useToast`)

### A creer (priorite)

| Composant | Remplace | Priorite |
|---|---|---|
| `UiPageHeader.vue` | `.devoirs-header`, `.agenda-header`, `.lumen-topbar`, `.docs-header`, `.channel-header` | P0 |
| `UiCard.vue` | `.dv-proj-card`, `.sa-card`, `.travail-card`, `.doc-card`, `.dv-next-card`, `.identity-card`, `.tp-card-header`, `.mpc-promo-header` | P0 |
| `UiEmptyState.vue` | `.dv-empty`, `.welcome-icon-wrapper`, `.empty-icon-wrap` | P0 |
| `UiButton.vue` | wraper sur `.btn-primary/.btn-ghost/.btn-danger` (a11y, loading) | P1 |
| `UiInput.vue` | wrapper `.form-input` (label + helper + error inline) | P1 |
| `UiPill.vue` | `.dv-stat-pill`, `.devoir-type-badge` | P2 |
| `UiSectionTitle.vue` | `.dv-section-title`, `.db-section-title`, `.sa-section-label` | P2 |

### Conventions

- Props typees, defauts explicites
- Slots nommes (`#leading`, `#trailing`, `#actions`)
- Variants via prop string union (`variant: 'primary' | 'ghost' | 'danger'`)
- Tailles via prop string union (`size: 'sm' | 'md' | 'lg'`)
- Pas de `<style scoped>` qui duplique des classes globales — referencer les
  classes utilitaires de `components.css` quand elles existent

---

## 8. Patterns d'interaction

### Headers de section
- Hauteur : `var(--header-height)` (52px)
- Background : `var(--bg-main)`
- Padding : `0 var(--space-xl)`
- Border-bottom : `1px solid var(--border)`
- Box-shadow : `--elevation-2`
- Z-index : 10

### Cartes
- Background : `var(--bg-elevated)`
- Border : `1px solid var(--border)`
- Border-radius : `var(--radius-lg)`
- Padding : `var(--space-lg)`
- Hover : `transform: translateY(-3px)` + `--elevation-2`
- Transition : `var(--motion-base) var(--ease-out)`

### Modales
- Backdrop : `rgba(0,0,0,.7)` + `backdrop-filter: blur(3px)`
- Border-radius : `var(--radius-lg)`
- Box-shadow : `--elevation-4`
- Width : `min(Xpx, 92vw)` (sm/md/lg)
- Padding header/footer : `var(--space-lg) var(--space-xl)`
- Anim : scale(.96)→scale(1) + opacity, `--motion-base var(--ease-out)`

### Empty states
- Icon wrapper : 56-64px, fond `rgba(var(--accent-rgb), .1)`
- Padding : `var(--space-2xl) var(--space-xl)`
- Texte centre, max-width 340px

---

## 9. Anti-patterns

A bannir activement :

1. **Hex hardcode** dans un `.vue` ou un CSS module → utiliser un token
2. **`box-shadow` ad-hoc** → utiliser `--elevation-N`
3. **`transition` ad-hoc** (`.2s ease`) → utiliser `--motion-* var(--ease-*)`
4. **`outline: ...` ad-hoc** sur focus → utiliser `--focus-ring`
5. **Padding/gap non aligne** sur l'echelle 4/8/12/16/24 → snap au token
6. **Reinventer une carte/header/empty** quand un composant `Ui*` existe
7. **Emoji comme icone** structurelle → SVG (deja respecte via lucide-vue-next)
8. **`width: 30px; height: 30px;`** sur boutons → 32px min (touch target)
9. **Mixer 2 polices** → Inter Variable uniquement
10. **`rgba(74,144,217, ...)`** hors blocs theme-specifiques → `rgba(var(--accent-rgb), ...)`

---

## 10. Verification avant livraison

- [ ] Pas de hex hardcode dans le diff
- [ ] Tous les paddings/gaps sur tokens `--space-*`
- [ ] Toutes les ombres sur `--elevation-*`
- [ ] Toutes les transitions sur `--motion-* var(--ease-*)`
- [ ] Focus visible sur tous les elements interactifs
- [ ] Touch targets >= 32px (desktop)
- [ ] Contraste >= 4.5:1 (verifie par les tokens deja AA/AAA compliant)
- [ ] `prefers-reduced-motion` respecte
- [ ] Tests verts
- [ ] Tester en switchant les 4 themes (default/cursus/marine/pulse)
