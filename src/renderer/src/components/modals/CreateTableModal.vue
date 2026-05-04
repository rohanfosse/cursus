<script setup lang="ts">
/**
 * CreateTableModal - builder visuel pour la commande slash /tableau.
 *
 * Plutot que d'injecter un template markdown brut dans le textarea (edition
 * manuelle fastidieuse, risque d'erreurs de syntaxe | et ---), on propose :
 *  - Une grille visuelle type "feuille de calcul" ou chaque cellule est un
 *    input editable.
 *  - Boutons d'ajout/suppression de colonnes et lignes.
 *  - Alignement par colonne (gauche / centre / droite), applique a la ligne
 *    de separation markdown (:--- / :---: / ---:).
 *  - Apercu Markdown en bas, regenere a chaque frappe.
 *  - Tab passe a la cellule suivante, Shift+Tab recule, Enter descend d'une
 *    ligne (ou ajoute une ligne si on est sur la derniere).
 *
 * Emits :
 *  - update:modelValue : fermeture du modal
 *  - submit { markdown } : la chaine markdown du tableau prete a inserer.
 */
import { ref, computed, watch, nextTick } from 'vue'
import {
  X, Table, Plus, Minus, Trash2, Send,
  AlignLeft, AlignCenter, AlignRight,
  LayoutGrid, ClipboardPaste, ArrowRight, Check as CheckIcon,
} from 'lucide-vue-next'

interface Props {
  modelValue: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  /** Insertion uniquement (dans le textarea, pour ajouter du texte autour). */
  'submit': [payload: { markdown: string }]
  /** Envoi immediat dans le canal (skip le textarea, 1 clic de moins). */
  'submit-send': [payload: { markdown: string }]
}>()

// ── Limites ────────────────────────────────────────────────────────────────
const MIN_COLS = 1
const MAX_COLS = 8
const MIN_ROWS = 1   // rows = lignes de donnees (hors entete)
const MAX_ROWS = 20

type Align = 'left' | 'center' | 'right'

// ── Etat du tableau ────────────────────────────────────────────────────────
const headers = ref<string[]>(['', '', ''])
const rows    = ref<string[][]>([['', '', ''], ['', '', '']])
const aligns  = ref<Align[]>(['left', 'left', 'left'])

// Refs des inputs pour la navigation clavier (Tab = cellule suivante).
// On indexe par `row-col` ou row = -1 pour l'entete.
const cellRefs = ref<Map<string, HTMLInputElement>>(new Map())
function setCellRef(row: number, col: number) {
  return (el: Element | any | null) => {
    const key = `${row}-${col}`
    if (el && 'focus' in el) cellRefs.value.set(key, el as HTMLInputElement)
    else cellRefs.value.delete(key)
  }
}
function focusCell(row: number, col: number) {
  const key = `${row}-${col}`
  nextTick(() => cellRefs.value.get(key)?.focus())
}

// ── Onglets : grille (edition cellule par cellule) vs CSV (coller un bloc) ─
type Tab = 'grid' | 'csv'
const tab = ref<Tab>('grid')

// ── Reset a l'ouverture : nouvelle table 3x2 vide ──────────────────────────
watch(() => props.modelValue, (open) => {
  if (!open) return
  headers.value = ['', '', '']
  rows.value = [['', '', ''], ['', '', '']]
  aligns.value = ['left', 'left', 'left']
  tab.value = 'grid'
  csvText.value = ''
  csvHasHeader.value = true
  csvJustImported.value = false
  focusCell(-1, 0) // focus sur la 1re cellule d'entete
})

// ── Onglet CSV : textarea + parseur + import dans la grille ────────────────
const csvText = ref('')
const csvHasHeader = ref(true)
const csvTextareaEl = ref<HTMLTextAreaElement | null>(null)
/** Flash de confirmation visible ~1.5s apres import reussi. */
const csvJustImported = ref(false)

/**
 * Detecte le separateur le plus probable sur la 1re ligne non vide.
 * Ordre de priorite : tab > point-virgule > virgule (convention Excel FR).
 */
function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
  const counts = {
    '\t': (firstLine.match(/\t/g) || []).length,
    ';':  (firstLine.match(/;/g)  || []).length,
    ',':  (firstLine.match(/,/g)  || []).length,
  }
  if (counts['\t'] > 0) return '\t'
  if (counts[';'] >= counts[','] && counts[';'] > 0) return ';'
  return ','
}

/**
 * Parse CSV basique avec support des guillemets (RFC 4180 allege) :
 *   - "cellule avec, virgule" -> une seule cellule
 *   - "cellule avec ""guillemets""" -> cellule avec "guillemets"
 * Pas d'escape-backslash, pas de commentaires.
 */
function parseCsv(text: string, sep: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { cell += c }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === sep) { row.push(cell); cell = '' }
      else if (c === '\r') { /* skip (handled with \n) */ }
      else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = '' }
      else { cell += c }
    }
  }
  // Derniere cellule / ligne si le texte ne finit pas par \n
  if (cell.length > 0 || row.length > 0) { row.push(cell); out.push(row) }
  // Filtre les lignes totalement vides (ex. ligne vide finale ou separateurs sans contenu)
  return out.filter(r => r.some(c => c.trim().length > 0))
}

/** Aperçu : nb colonnes et lignes qui seront creees si on importe. */
const csvPreview = computed(() => {
  const text = csvText.value.trim()
  if (!text) return null
  const sep = detectSeparator(text)
  const parsed = parseCsv(text, sep)
  if (!parsed.length) return null
  const cols = Math.min(MAX_COLS, Math.max(...parsed.map(r => r.length)))
  const dataLines = csvHasHeader.value ? parsed.length - 1 : parsed.length
  const rowsCount = Math.max(0, Math.min(MAX_ROWS, dataLines))
  return {
    separator: sep === '\t' ? 'Tabulation' : sep === ';' ? 'Point-virgule (;)' : 'Virgule (,)',
    cols,
    rows: rowsCount,
    total: parsed.length,
    truncated: parsed.length > (csvHasHeader.value ? MAX_ROWS + 1 : MAX_ROWS)
      || Math.max(...parsed.map(r => r.length)) > MAX_COLS,
  }
})

const canImportCsv = computed(() => csvPreview.value !== null && csvPreview.value.cols >= 1)

/**
 * Remplit la grille a partir d'un texte CSV/TSV arbitraire. Factorise entre
 * l'onglet CSV (bouton "Importer") et le paste direct dans une cellule de
 * la grille.
 */
function fillGridFromText(text: string, hasHeader: boolean): boolean {
  const clean = text.trim()
  if (!clean) return false
  const sep = detectSeparator(clean)
  const parsed = parseCsv(clean, sep)
  if (!parsed.length) return false
  const cols = Math.min(MAX_COLS, Math.max(...parsed.map(r => r.length)))
  const norm = parsed.map(r => {
    const padded = r.slice(0, cols)
    while (padded.length < cols) padded.push('')
    return padded
  })
  if (hasHeader && norm.length > 0) {
    headers.value = norm[0]
    rows.value = norm.slice(1, 1 + MAX_ROWS)
  } else {
    headers.value = new Array(cols).fill('')
    rows.value = norm.slice(0, MAX_ROWS)
  }
  if (rows.value.length === 0) rows.value = [new Array(cols).fill('')]
  aligns.value = new Array(cols).fill('left')
  return true
}

function importCsv() {
  if (!canImportCsv.value) return
  const text = csvText.value.trim()
  const sep = detectSeparator(text)
  const parsed = parseCsv(text, sep)
  const cols = Math.min(MAX_COLS, Math.max(...parsed.map(r => r.length)))

  // Normalise : chaque ligne a exactement `cols` cellules (pad vide a droite).
  const norm = parsed.map(r => {
    const padded = r.slice(0, cols)
    while (padded.length < cols) padded.push('')
    return padded
  })

  if (csvHasHeader.value && norm.length > 0) {
    headers.value = norm[0]
    rows.value = norm.slice(1, 1 + MAX_ROWS)
  } else {
    // Pas d'entete : ligne d'en-tete vide (Colonne 1, 2, ...) + toutes les donnees
    headers.value = new Array(cols).fill('')
    rows.value = norm.slice(0, MAX_ROWS)
  }
  // Garantit au moins 1 ligne de donnees affichee pour que le builder
  // ne se retrouve pas avec un tableau "en-tete seule" (edition impossible).
  if (rows.value.length === 0) rows.value = [new Array(cols).fill('')]
  aligns.value = new Array(cols).fill('left')

  csvJustImported.value = true
  setTimeout(() => { csvJustImported.value = false }, 1800)
  // Bascule en mode grille pour que l'utilisateur voie immediatement le rendu
  // et puisse ajuster. C'est l'action attendue : "importer puis polir".
  tab.value = 'grid'
  focusCell(-1, 0)
}

/** Exemple pret a coller pour aider les nouveaux utilisateurs. */
const csvExample = `Nom,Promo,Note
Alice,BTS1,18
Bob,BTS2,15
Camille,BTS1,17`

function pasteExample() {
  csvText.value = csvExample
  nextTick(() => csvTextareaEl.value?.focus())
}

function switchTab(t: Tab) {
  tab.value = t
  if (t === 'csv') nextTick(() => csvTextareaEl.value?.focus())
  else focusCell(-1, 0)
}

// ── Operations sur la structure ───────────────────────────────────────────
function addColumn() {
  if (headers.value.length >= MAX_COLS) return
  headers.value.push('')
  aligns.value.push('left')
  for (const r of rows.value) r.push('')
  focusCell(-1, headers.value.length - 1)
}
function removeColumn(col: number) {
  if (headers.value.length <= MIN_COLS) return
  headers.value.splice(col, 1)
  aligns.value.splice(col, 1)
  for (const r of rows.value) r.splice(col, 1)
}
function addRow() {
  if (rows.value.length >= MAX_ROWS) return
  rows.value.push(new Array(headers.value.length).fill(''))
  focusCell(rows.value.length - 1, 0)
}
function removeRow(row: number) {
  if (rows.value.length <= MIN_ROWS) return
  rows.value.splice(row, 1)
}
function setAlign(col: number, a: Align) {
  aligns.value[col] = a
}

// ── Navigation clavier ────────────────────────────────────────────────────
function onCellKeydown(e: KeyboardEvent, row: number, col: number) {
  // Tab / Shift+Tab : cellule suivante / precedente (wrap sur la ligne)
  if (e.key === 'Tab') {
    e.preventDefault()
    const cols = headers.value.length
    const totalCells = cols * (rows.value.length + 1)
    const currentIdx = (row + 1) * cols + col
    const nextIdx = e.shiftKey
      ? (currentIdx - 1 + totalCells) % totalCells
      : (currentIdx + 1) % totalCells
    const nRow = Math.floor(nextIdx / cols) - 1
    const nCol = nextIdx % cols
    focusCell(nRow, nCol)
    return
  }
  // Enter : descend a la ligne du dessous (ajoute si on est en bas)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (row === rows.value.length - 1) addRow()
    else focusCell(row + 1, col)
    return
  }
  // Ctrl/Cmd + Enter : envoie directement (1 clic de moins, action la plus
  // demandee). Shift+Ctrl+Enter = juste inserer dans le textarea.
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (!canSubmit.value) return
    if (e.shiftKey) submit()
    else submitAndSend()
    return
  }
}

/**
 * Paste detection dans une cellule : si l'utilisateur colle un texte CSV/TSV
 * multi-lignes depuis Excel/Sheets directement dans une cellule, on bascule
 * en mode "import" et on remplit la grille entiere. Reduit un clic : plus
 * besoin d'aller dans l'onglet "Coller un CSV" explicitement.
 */
function onCellPaste(e: ClipboardEvent, row: number, col: number) {
  const text = e.clipboardData?.getData('text') ?? ''
  // Heuristique : c'est un bloc multi-cellules si on a un tab OU plusieurs
  // lignes. Un simple texte avec virgule ne declenche PAS l'import (evite
  // les faux positifs sur "Salut, ca va ?").
  const hasTab = text.includes('\t')
  const hasMultiline = /\r?\n.+/.test(text.trim())
  if (!hasTab && !hasMultiline) return
  e.preventDefault()
  // Premiere ligne = header seulement si on colle dans la ligne d'entete (-1).
  const useHeader = row === -1
  const ok = fillGridFromText(text, useHeader)
  if (!ok) return
  pasteFlash.value = true
  setTimeout(() => { pasteFlash.value = false }, 1800)
  // Remonte le focus sur la cellule origine pour continuer l'edition si
  // la grille a ete remplie en place.
  focusCell(useHeader ? -1 : Math.min(row, rows.value.length - 1), col)
}

/** Flash visible apres un paste CSV detecte dans une cellule. */
const pasteFlash = ref(false)

// ── Validation ────────────────────────────────────────────────────────────
// Au moins 1 cellule d'entete remplie OU 1 cellule de donnee remplie
// (une table entierement vide serait un "tableau fantome" peu utile).
const canSubmit = computed(() => {
  const hasHeader = headers.value.some(h => h.trim().length > 0)
  const hasData = rows.value.some(r => r.some(c => c.trim().length > 0))
  return hasHeader || hasData
})

// ── Generation du markdown ────────────────────────────────────────────────
function alignMarker(a: Align): string {
  if (a === 'center') return ':---:'
  if (a === 'right')  return '---:'
  return ':---'
}
function escapePipe(s: string): string {
  // Pipe litteral dans un tableau markdown doit etre echappe (\|). Idem \n
  // qui casserait la ligne — remplace par un espace.
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
}
function buildHeaderRow(): string {
  return `| ${headers.value.map(h => escapePipe(h) || ' ').join(' | ')} |`
}
function buildSeparatorRow(): string {
  return `| ${aligns.value.map(a => alignMarker(a)).join(' | ')} |`
}
function buildDataRow(r: string[]): string {
  return `| ${r.map(c => escapePipe(c) || ' ').join(' | ')} |`
}
const markdownPreview = computed(() => {
  const lines = [buildHeaderRow(), buildSeparatorRow()]
  for (const r of rows.value) lines.push(buildDataRow(r))
  return lines.join('\n')
})

function close() { emit('update:modelValue', false) }

function submit() {
  if (!canSubmit.value) return
  emit('submit', { markdown: markdownPreview.value })
  close()
}
/** Envoie directement dans le canal (1 clic de moins vs insert + send manuel). */
function submitAndSend() {
  if (!canSubmit.value) return
  emit('submit-send', { markdown: markdownPreview.value })
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="ctm-modal" role="dialog" aria-modal="true" aria-label="Créer un tableau">
          <!-- Header -->
          <div class="ctm-header">
            <Table :size="18" class="ctm-header-icon" />
            <div class="ctm-header-text">
              <h2 class="ctm-title">Nouveau tableau</h2>
              <p class="ctm-sub">
                {{ headers.length }} colonne<template v-if="headers.length > 1">s</template>
                · {{ rows.length }} ligne<template v-if="rows.length > 1">s</template>
              </p>
            </div>
            <button class="btn-icon ctm-close" aria-label="Fermer" @click="close">
              <X :size="16" />
            </button>
          </div>

          <!-- Onglets : Grille (cellule par cellule) vs Coller CSV ────────── -->
          <div class="ctm-tabs" role="tablist" aria-label="Mode de saisie">
            <button
              type="button"
              role="tab"
              class="ctm-tab"
              :class="{ 'is-active': tab === 'grid' }"
              :aria-selected="tab === 'grid'"
              @click="switchTab('grid')"
            >
              <LayoutGrid :size="14" /> Grille
            </button>
            <button
              type="button"
              role="tab"
              class="ctm-tab"
              :class="{ 'is-active': tab === 'csv' }"
              :aria-selected="tab === 'csv'"
              @click="switchTab('csv')"
            >
              <ClipboardPaste :size="14" /> Coller un CSV
            </button>
            <span v-if="csvJustImported" class="ctm-tabs-flash" aria-live="polite">
              <CheckIcon :size="12" /> Importé dans la grille
            </span>
            <span v-else-if="pasteFlash" class="ctm-tabs-flash" aria-live="polite">
              <CheckIcon :size="12" /> Collage détecté — grille remplie
            </span>
          </div>

          <!-- Zone d'edition : scrollable horizontalement si beaucoup de cols -->
          <div v-show="tab === 'grid'" class="ctm-body">
            <div class="ctm-scroll">
              <table class="ctm-grid">
                <!-- Ligne d'alignement par colonne (boutons) -->
                <thead>
                  <tr class="ctm-align-row">
                    <th v-for="(_, col) in headers" :key="'a-' + col" class="ctm-align-cell">
                      <div class="ctm-align-btns" role="group" aria-label="Alignement de la colonne">
                        <button
                          type="button"
                          class="ctm-align-btn"
                          :class="{ 'is-active': aligns[col] === 'left' }"
                          :aria-pressed="aligns[col] === 'left'"
                          title="Aligner à gauche"
                          @click="setAlign(col, 'left')"
                        ><AlignLeft :size="12" /></button>
                        <button
                          type="button"
                          class="ctm-align-btn"
                          :class="{ 'is-active': aligns[col] === 'center' }"
                          :aria-pressed="aligns[col] === 'center'"
                          title="Centrer"
                          @click="setAlign(col, 'center')"
                        ><AlignCenter :size="12" /></button>
                        <button
                          type="button"
                          class="ctm-align-btn"
                          :class="{ 'is-active': aligns[col] === 'right' }"
                          :aria-pressed="aligns[col] === 'right'"
                          title="Aligner à droite"
                          @click="setAlign(col, 'right')"
                        ><AlignRight :size="12" /></button>
                      </div>
                    </th>
                    <th class="ctm-corner" />
                  </tr>
                  <!-- Ligne d'en-tetes editable -->
                  <tr class="ctm-header-row">
                    <th
                      v-for="(h, col) in headers"
                      :key="'h-' + col"
                      class="ctm-header-cell"
                      :style="{ textAlign: aligns[col] }"
                    >
                      <div class="ctm-cell-wrap">
                        <input
                          :ref="setCellRef(-1, col)"
                          v-model="headers[col]"
                          type="text"
                          class="ctm-cell-input ctm-cell-input--header"
                          :style="{ textAlign: aligns[col] }"
                          :placeholder="`Colonne ${col + 1}`"
                          :aria-label="`En-tête colonne ${col + 1}`"
                          @keydown="onCellKeydown($event, -1, col)"
                          @paste="onCellPaste($event, -1, col)"
                        />
                        <button
                          v-if="headers.length > MIN_COLS"
                          type="button"
                          class="ctm-col-remove"
                          :aria-label="`Supprimer la colonne ${col + 1}`"
                          title="Supprimer cette colonne"
                          @click="removeColumn(col)"
                        ><Minus :size="10" /></button>
                      </div>
                    </th>
                    <th class="ctm-corner">
                      <button
                        type="button"
                        class="ctm-add-col"
                        :disabled="headers.length >= MAX_COLS"
                        aria-label="Ajouter une colonne"
                        title="Ajouter une colonne"
                        @click="addColumn"
                      ><Plus :size="13" /></button>
                    </th>
                  </tr>
                </thead>

                <!-- Lignes de donnees -->
                <tbody>
                  <tr v-for="(r, row) in rows" :key="'r-' + row" class="ctm-data-row">
                    <td
                      v-for="(_, col) in headers"
                      :key="'c-' + row + '-' + col"
                      class="ctm-data-cell"
                      :style="{ textAlign: aligns[col] }"
                    >
                      <input
                        :ref="setCellRef(row, col)"
                        v-model="rows[row][col]"
                        type="text"
                        class="ctm-cell-input"
                        :style="{ textAlign: aligns[col] }"
                        :aria-label="`Ligne ${row + 1} colonne ${col + 1}`"
                        @keydown="onCellKeydown($event, row, col)"
                        @paste="onCellPaste($event, row, col)"
                      />
                    </td>
                    <td class="ctm-row-action">
                      <button
                        v-if="rows.length > MIN_ROWS"
                        type="button"
                        class="ctm-row-remove"
                        :aria-label="`Supprimer la ligne ${row + 1}`"
                        title="Supprimer cette ligne"
                        @click="removeRow(row)"
                      ><Trash2 :size="12" /></button>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td :colspan="headers.length + 1" class="ctm-add-row-wrap">
                      <button
                        type="button"
                        class="ctm-add-row"
                        :disabled="rows.length >= MAX_ROWS"
                        @click="addRow"
                      >
                        <Plus :size="12" /> Ajouter une ligne
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Apercu markdown (replie par defaut, utile pour les power-users) -->
            <details class="ctm-preview">
              <summary class="ctm-preview-summary">Aperçu Markdown</summary>
              <pre class="ctm-preview-code"><code>{{ markdownPreview }}</code></pre>
            </details>

            <!-- Hint raccourcis clavier -->
            <div class="ctm-hints">
              <span><kbd>Tab</kbd> cellule suivante</span>
              <span><kbd>Enter</kbd> ligne suivante</span>
              <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> envoyer directement</span>
              <span class="ctm-hint-muted">(collage multi-cellules détecté automatiquement)</span>
            </div>
          </div>

          <!-- ═══ ONGLET CSV : coller un tableur, import en 1 clic ═════════ -->
          <div v-show="tab === 'csv'" class="ctm-body">
            <div class="ctm-csv-intro">
              <p class="ctm-csv-intro-text">
                Collez votre tableau depuis <strong>Excel</strong>, <strong>Google Sheets</strong>
                ou un fichier <strong>CSV</strong>. Les colonnes séparées par tabulation,
                virgule ou point-virgule sont détectées automatiquement.
              </p>
              <button type="button" class="ctm-csv-example-btn" @click="pasteExample">
                Exemple rapide
              </button>
            </div>

            <textarea
              ref="csvTextareaEl"
              v-model="csvText"
              class="ctm-csv-textarea"
              rows="8"
              spellcheck="false"
              :placeholder="`Nom\tPromo\tNote\nAlice\tBTS1\t18\nBob\tBTS2\t15\n…`"
              aria-label="Contenu CSV à importer"
            />

            <!-- Options de parsing + apercu de la detection -->
            <div class="ctm-csv-options">
              <label class="ctm-csv-toggle">
                <input v-model="csvHasHeader" type="checkbox" />
                <span>Première ligne = en-tête</span>
              </label>
              <div v-if="csvPreview" class="ctm-csv-stats" aria-live="polite">
                <span class="ctm-csv-stat">
                  <strong>{{ csvPreview.cols }}</strong> col<template v-if="csvPreview.cols > 1">s</template>
                </span>
                <span class="ctm-csv-stat">
                  <strong>{{ csvPreview.rows }}</strong> ligne<template v-if="csvPreview.rows > 1">s</template>
                </span>
                <span class="ctm-csv-sep">Séparateur&nbsp;: <em>{{ csvPreview.separator }}</em></span>
                <span v-if="csvPreview.truncated" class="ctm-csv-warn" :title="`Max ${MAX_COLS} colonnes × ${MAX_ROWS} lignes`">
                  Tronqué à {{ MAX_COLS }}×{{ MAX_ROWS }}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="ctm-csv-import-btn"
              :disabled="!canImportCsv"
              @click="importCsv"
            >
              <ArrowRight :size="14" />
              Importer dans la grille
            </button>

            <p class="ctm-csv-foot">
              Astuce : sélectionnez vos cellules dans Excel puis Ctrl+C. Collez ici et
              cliquez sur « Importer ». Vous pourrez ensuite ajuster chaque cellule dans
              l'onglet Grille avant insertion.
            </p>
          </div>

          <!-- Footer : CTA primaire = envoi direct (1 clic de moins),
               secondaire = inserer dans le textarea pour ajouter du texte. -->
          <div class="ctm-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button
              type="button"
              class="ctm-btn-secondary"
              :disabled="!canSubmit"
              title="Insérer dans le message pour ajouter du texte autour"
              @click="submit"
            >
              Insérer dans le message
            </button>
            <button
              type="button"
              class="ctm-btn-primary"
              :disabled="!canSubmit"
              title="Envoyer directement dans le canal"
              @click="submitAndSend"
            >
              <Send :size="14" /> Envoyer le tableau
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Animation overlay (meme pattern que CreatePollModal) ───────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, .45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }

/* ── Conteneur modal ───────────────────────────────────────────────────── */
.ctm-modal {
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--elevation-4);
  overflow: hidden;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.ctm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.ctm-header-icon {
  color: var(--accent);
  padding: 6px;
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  background: rgba(var(--accent-rgb), .12);
  flex-shrink: 0;
  box-sizing: content-box;
}
.ctm-header-text { flex: 1; min-width: 0; }
.ctm-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.ctm-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  margin: 2px 0 0;
}
.ctm-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.ctm-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Onglets Grille / CSV ─────────────────────────────────────────────── */
.ctm-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 18px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.ctm-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px; /* chevauche la border-bottom du conteneur */
  cursor: pointer;
  transition: color var(--t-fast), border-color var(--t-fast), background var(--t-fast);
  border-top-left-radius: var(--radius-sm);
  border-top-right-radius: var(--radius-sm);
}
.ctm-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.ctm-tab.is-active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: transparent;
}
/* Flash "importe" apres un import CSV reussi */
.ctm-tabs-flash {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-success);
  background: rgba(var(--color-success-rgb), .12);
  border: 1px solid rgba(var(--color-success-rgb), .3);
  border-radius: var(--radius);
  animation: ctm-flash-in .25s var(--ease-out);
}
@keyframes ctm-flash-in {
  from { opacity: 0; transform: translateY(-3px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Body ──────────────────────────────────────────────────────────────── */
.ctm-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* ── Zone d'edition de la grille ──────────────────────────────────────── */
.ctm-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  padding: 8px;
}
.ctm-grid {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  min-width: 360px;
}

/* Ligne d'alignement : petits boutons discrets au-dessus de chaque colonne */
.ctm-align-row { background: transparent; }
.ctm-align-cell {
  padding: 0 3px 4px;
  text-align: center;
  font-weight: normal;
}
.ctm-align-btns {
  display: inline-flex;
  gap: 1px;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  border: 1px solid var(--border);
}
.ctm-align-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.ctm-align-btn:hover { background: var(--bg-active); color: var(--text-primary); }
.ctm-align-btn.is-active {
  background: var(--accent);
  color: #fff;
}

/* Ligne d'en-tetes : fond accent-subtle */
.ctm-header-row { background: transparent; }
.ctm-header-cell {
  padding: 3px;
  min-width: 120px;
  font-weight: normal;
}
.ctm-header-cell .ctm-cell-input--header {
  font-weight: 700;
  background: rgba(var(--accent-rgb), .08);
  border-color: rgba(var(--accent-rgb), .25);
  color: var(--text-primary);
}
.ctm-header-cell .ctm-cell-input--header::placeholder {
  font-weight: 500;
  color: var(--text-muted);
}

.ctm-cell-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.ctm-col-remove {
  position: absolute;
  top: -6px;
  right: -4px;
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 50%;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
  transition: background var(--t-fast), color var(--t-fast);
  z-index: 2;
}
.ctm-header-cell:hover .ctm-col-remove,
.ctm-col-remove:focus-visible { display: inline-flex; }
.ctm-col-remove:hover {
  background: var(--color-danger);
  color: #fff;
  border-color: var(--color-danger);
}

/* Lignes de donnees */
.ctm-data-row {
  background: transparent;
  transition: background var(--t-fast);
}
.ctm-data-row:hover { background: rgba(var(--accent-rgb), .03); }
.ctm-data-cell {
  padding: 2px 3px;
  min-width: 120px;
}

/* Cellules input : discret au repos, s'active au focus */
.ctm-cell-input {
  width: 100%;
  padding: 7px 10px;
  font-family: var(--font);
  font-size: 13px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  transition: border-color var(--t-fast), box-shadow var(--t-fast), background var(--t-fast);
}
.ctm-cell-input:hover { border-color: var(--border-input); }
.ctm-cell-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-main);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}

/* Colonne "action" (supprimer ligne) a droite de chaque data-row */
.ctm-row-action {
  width: 34px;
  padding: 2px 4px 2px 6px;
  text-align: center;
}
.ctm-row-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: .4;
  transition: opacity var(--t-fast), background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ctm-data-row:hover .ctm-row-remove { opacity: 1; }
.ctm-row-remove:hover {
  color: var(--color-danger);
  background: rgba(var(--color-danger-rgb), .1);
  border-color: rgba(var(--color-danger-rgb), .25);
}

/* Coin haut-droit : bouton "+" pour ajouter une colonne */
.ctm-corner {
  width: 34px;
  text-align: center;
  padding: 3px;
}
.ctm-add-col {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px dashed var(--border-input);
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ctm-add-col:hover:not(:disabled) {
  background: rgba(var(--accent-rgb), .1);
  color: var(--accent);
  border-color: var(--accent);
  border-style: solid;
}
.ctm-add-col:disabled { opacity: .3; cursor: not-allowed; }

/* Footer bouton "Ajouter une ligne" */
.ctm-add-row-wrap {
  padding: 6px 4px 0;
}
.ctm-add-row {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-input);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ctm-add-row:hover:not(:disabled) {
  background: rgba(var(--accent-rgb), .08);
  color: var(--accent);
  border-color: var(--accent);
  border-style: solid;
}
.ctm-add-row:disabled { opacity: .4; cursor: not-allowed; }

/* ── Apercu markdown ──────────────────────────────────────────────────── */
.ctm-preview {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
}
.ctm-preview-summary {
  padding: 8px 12px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .4px;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.ctm-preview-summary::-webkit-details-marker { display: none; }
.ctm-preview-summary::before {
  content: '\25B6';
  font-size: 8px;
  color: var(--text-muted);
  transition: transform var(--motion-fast) var(--ease-out);
}
.ctm-preview[open] > .ctm-preview-summary::before { transform: rotate(90deg); }
.ctm-preview-code {
  margin: 0;
  padding: 10px 12px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: var(--bg-main);
  border-top: 1px solid var(--border);
  overflow-x: auto;
  white-space: pre;
}

/* ── Hints raccourcis clavier ─────────────────────────────────────────── */
.ctm-hints {
  display: flex;
  gap: 14px;
  justify-content: center;
  font-size: 10.5px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.ctm-hints kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9.5px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  font-family: var(--font);
  margin: 0 2px;
}
.ctm-hint-muted { opacity: .7; font-style: italic; }

/* ══════════════════════════════════════════════════════════════════════════
   ONGLET CSV : import par copier-coller depuis Excel / Sheets / fichier
   ══════════════════════════════════════════════════════════════════════════ */
.ctm-csv-intro {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(var(--accent-rgb), .06);
  border: 1px solid rgba(var(--accent-rgb), .2);
}
.ctm-csv-intro-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  flex: 1;
}
.ctm-csv-intro-text strong { color: var(--text-primary); font-weight: 700; }
.ctm-csv-example-btn {
  flex-shrink: 0;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-main);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), .35);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.ctm-csv-example-btn:hover {
  background: rgba(var(--accent-rgb), .12);
  border-color: var(--accent);
}

.ctm-csv-textarea {
  width: 100%;
  min-height: 180px;
  padding: 12px 14px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  resize: vertical;
  tab-size: 4;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.ctm-csv-textarea::placeholder { color: var(--text-muted); opacity: .7; }
.ctm-csv-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}

.ctm-csv-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 8px 2px;
  border-top: 1px dashed var(--border);
  border-bottom: 1px dashed var(--border);
}
.ctm-csv-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}
.ctm-csv-toggle input {
  margin: 0;
  cursor: pointer;
  accent-color: var(--accent);
}

.ctm-csv-stats {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--text-muted);
}
.ctm-csv-stat {
  padding: 3px 9px;
  border-radius: var(--radius);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.ctm-csv-stat strong { color: var(--text-primary); font-weight: 700; margin-right: 2px; }
.ctm-csv-sep em {
  font-style: normal;
  font-weight: 600;
  color: var(--text-secondary);
}
.ctm-csv-warn {
  font-weight: 700;
  color: var(--color-warning);
  cursor: help;
}

.ctm-csv-import-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  transition: background var(--t-fast), transform var(--t-fast);
}
.ctm-csv-import-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 88%, black);
  transform: translateY(-1px);
}
.ctm-csv-import-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
  box-shadow: none;
}

.ctm-csv-foot {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ── Footer ────────────────────────────────────────────────────────────── */
.ctm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}

/* Bouton secondaire "Inserer dans le message" : outline, meme poids que le
   CTA primaire pour laisser le choix clairement au user. */
.ctm-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ctm-btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.ctm-btn-secondary:disabled { opacity: .45; cursor: not-allowed; }

/* Bouton primaire "Envoyer le tableau" : CTA emerald (alignement landing) */
.ctm-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--cta);
  color: #fff;
  border: 1px solid var(--cta);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  transition: background var(--t-fast), transform var(--t-fast);
}
.ctm-btn-primary:hover:not(:disabled) {
  background: var(--cta-hover);
  transform: translateY(-1px);
}
.ctm-btn-primary:disabled {
  opacity: .45;
  cursor: not-allowed;
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
  box-shadow: none;
}
</style>
