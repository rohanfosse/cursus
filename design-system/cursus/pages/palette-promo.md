# Palette promo — 8 couleurs canoniques

> **Override partiel** de MASTER.md. Les regles ci-dessous s'appliquent
> exclusivement aux promotions (identite visuelle d'une classe/promo).
> Le reste (dark/light tokens, typo, motion...) suit MASTER.

---

## Contexte

Chaque promotion recoit une couleur d'identification visible dans :

- Le calendrier (evenements deadline/start avec `border-left` + `color-mix` bg)
- La sidebar (rail de navigation `PromoRail.vue`)
- Le dashboard (cartes de promo, badges)
- Les modales de selection

Avant v2.163.0, les profs choisissaient librement un hex → resultats incoherents
(3 bleus qui se ressemblent, 2 verts, etc.). La palette fermee resout ce probleme.

---

## Les 8 couleurs

| Slug | Label FR | Hex | HSL approx |
|---|---|---|---|
| `sky` | Ciel | `#4A90D9` | 210° 65% 57% |
| `violet` | Violet | `#8E5FC5` | 268° 47% 58% |
| `rose` | Rose | `#D65B8F` | 335° 60% 60% |
| `orange` | Orange | `#E8891A` | 30° 81% 51% |
| `amber` | Ambre | `#E5B84A` | 43° 75% 59% |
| `green` | Vert | `#2EB871` | 146° 60% 45% |
| `teal` | Sarcelle | `#14B8A6` | 174° 80% 40% |
| `slate` | Ardoise | `#64748B` | 215° 16% 47% |

**Critères de calibration** :
- Repartition ~45° en HSL sur le cercle chromatique (8 positions distinctes)
- Saturation 60-80% (vivid mais pas fluo)
- Lightness 45-60% (readable sur dark ET light backgrounds, WCAG AA mini)
- Aucune couleur trop proche d'un token semantique (success/danger/info)

---

## API

```typescript
import {
  PROMO_PALETTE,               // readonly array des 8 couleurs
  DEFAULT_PROMO_COLOR,         // = PROMO_PALETTE[0].value
  getPromoColorFromName,       // (name) → hex deterministe
  isPaletteColor,              // (hex) → bool, check O(1)
  normalizePromoColor,         // (hex, fallbackName) → hex toujours dans palette
} from '@/utils/promoPalette'
```

**Memoisation** : `getPromoColorFromName` et `normalizePromoColor` cachent leurs
resultats dans des Map module-level. Safe car purs et deterministes.

---

## UI

### Picker unique

```vue
<PromoColorPicker v-model="color" size="md" />  <!-- formulaires -->
<PromoColorPicker v-model="color" size="sm" />  <!-- dropdowns inline -->
```

**Rules** : ne jamais re-implementer un color picker. Si un besoin de picker
"ouvert" (hex libre) apparait — justifier dans une RFC et creer un composant
separe (`UiColorPicker.vue`), ne pas reutiliser `PromoColorPicker`.

### Affichage d'une couleur promo

Un dot rond ou un carre arrondi suffit :

```vue
<span class="promo-dot" :style="{ background: promo.color }" />
```

**CSS** : `color-mix()` pour les backgrounds d'event, pas de rgba litteral.

```css
.my-event {
  border-left: 3px solid var(--ev-color);
  background: color-mix(in srgb, var(--ev-color) 18%, var(--bg-main));
  color: color-mix(in srgb, var(--ev-color) 88%, var(--text-primary));
}
```

---

## Auto-assignation (migration legacy)

Les promos creees avant v2.163.0 ont des hex arbitraires. Au lieu d'une
migration SQL (risquee, irreversible), on **normalise au read** :

```typescript
// Dans stores/agenda.ts, pour chaque event :
const promoColor = normalizePromoColor(row.promo_color, row.promo_name)
```

Effet : un hex legacy (`#FF00AA`, non dans palette) est automatiquement rendu
comme la couleur hash-derivee du nom de la promo. Deterministe, zero UI cassee.

Quand le prof edite sa promo via `CreatePromoModal`, il voit le picker avec les
8 couleurs et doit en choisir une. Au save, la valeur stockee en DB est alors
dans la palette.

---

## Garde-fous

- `check:design` ne verifie PAS la conformite des couleurs stockees en DB —
  seulement les hex hardcodes dans le code frontend.
- Le serveur n'impose pas de validation au niveau route (confiance UI).
  Migration DB a faire a l'occasion d'un hardening securitaire si besoin.

---

## Evolutions futures

- **Theme light** : les 8 couleurs sont calibrees dark-mode-first. Verifier
  le contraste sur light avant extension du theme.
- **Theme CESI officiel** : si CESI demande un branding (rouge corporate),
  ajouter un swatch optionnel au lieu de remplacer.
- **Accessibility** : option "palette daltoniens" avec 6 couleurs plus
  perceptuellement distinctes (deuteranopia-friendly). P3.
