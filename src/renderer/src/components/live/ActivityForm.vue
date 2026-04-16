<!-- ActivityForm.vue - Formulaire de création/édition d'activité Live (QCM / Sondage / Nuage) -->
<script setup lang="ts">
  import { ref, computed } from 'vue'
  import {
    ListChecks, ToggleLeft, Type, Link2, Hash, Plus, X,
    Code2, StickyNote, MessageSquare, Cloud, Star, FileText,
    BarChart, Smile, ArrowUpDown, Grid3X3,
  } from 'lucide-vue-next'
  import type { LiveActivity } from '@/types'

  const props = defineProps<{ initialData?: LiveActivity | null }>()

  type ActivityType =
    | 'qcm' | 'vrai_faux' | 'reponse_courte' | 'association' | 'estimation'
    | 'sondage_libre' | 'nuage' | 'echelle' | 'question_ouverte' | 'sondage' | 'humeur' | 'priorite' | 'matrice'
    | 'live_code' | 'board'

  const emit = defineEmits<{
    save: [payload: {
      type: ActivityType; title: string
      options?: string[] | string; max_words?: number; max_rating?: number
      timer_seconds?: number; correct_answers?: number[] | string[]
      language?: string
    }]
    cancel: []
  }>()

  const HUMEUR_EMOJIS = ['😊', '🙂', '😐', '😟', '🤯']

  const isEditing = !!props.initialData

  function parseOptions(data?: LiveActivity | null): string[] {
    if (!data?.options) return ['', '']
    try { return JSON.parse(data.options as unknown as string) } catch { return ['', ''] }
  }
  function parseCorrectAnswers(data?: LiveActivity | null): number[] {
    if (!data?.correct_answers) return []
    try { return JSON.parse(data.correct_answers as unknown as string) } catch { return [] }
  }
  function parseAcceptedAnswers(data?: LiveActivity | null): string[] {
    if (!data || data.type !== 'reponse_courte' || !data.correct_answers) return ['']
    try { const arr = JSON.parse(data.correct_answers as unknown as string); return Array.isArray(arr) ? arr : [''] } catch { return [''] }
  }
  function parseVraiFauxCorrect(data?: LiveActivity | null): 0 | 1 {
    if (!data || data.type !== 'vrai_faux' || !data.correct_answers) return 0
    try { const arr = JSON.parse(data.correct_answers as unknown as string); return arr[0] === 1 ? 1 : 0 } catch { return 0 }
  }

  function parsePairs(data?: LiveActivity | null): { left: string; right: string }[] {
    if (!data || data.type !== 'association' || !data.correct_answers) return [{ left: '', right: '' }, { left: '', right: '' }]
    try { const arr = JSON.parse(data.correct_answers as unknown as string); return Array.isArray(arr) ? arr : [{ left: '', right: '' }, { left: '', right: '' }] } catch { return [{ left: '', right: '' }, { left: '', right: '' }] }
  }
  function parseEstimation(data?: LiveActivity | null): { target: string; margin: string } {
    if (!data || data.type !== 'estimation' || !data.correct_answers) return { target: '', margin: '0' }
    try { const obj = JSON.parse(data.correct_answers as unknown as string); return { target: String(obj.target ?? ''), margin: String(obj.margin ?? '0') } } catch { return { target: '', margin: '0' } }
  }

  const activityType = ref<ActivityType>(props.initialData?.type ?? 'qcm')
  const acceptedAnswers = ref<string[]>(parseAcceptedAnswers(props.initialData))
  const vraiFauxCorrect = ref<0 | 1>(parseVraiFauxCorrect(props.initialData))
  const pairs = ref(parsePairs(props.initialData))
  const estimation = ref(parseEstimation(props.initialData))
  const title        = ref(props.initialData?.title ?? '')
  const options      = ref<string[]>(parseOptions(props.initialData))
  const timerSeconds = ref(props.initialData?.timer_seconds ?? 30)
  const correctAnswers = ref<number[]>(parseCorrectAnswers(props.initialData))
  const timerOptions = [10, 15, 20, 30, 45, 60, 90, 120]

  const typeCards = [
    // Spark (quiz gamifie)
    { id: 'qcm' as const,             label: 'QCM',             icon: ListChecks,   desc: 'Choix multiple', category: 'Spark' },
    { id: 'vrai_faux' as const,        label: 'Vrai / Faux',     icon: ToggleLeft,   desc: 'Question binaire', category: 'Spark' },
    { id: 'reponse_courte' as const,   label: 'Réponse courte',  icon: Type,         desc: 'Texte libre noté', category: 'Spark' },
    { id: 'association' as const,      label: 'Association',      icon: Link2,        desc: 'Relier les paires', category: 'Spark' },
    { id: 'estimation' as const,       label: 'Estimation',       icon: Hash,         desc: 'Réponse numérique', category: 'Spark' },
    // Pulse (feedback anonyme)
    { id: 'sondage_libre' as const,    label: 'Sondage libre',   icon: MessageSquare, desc: 'Texte libre anonyme', category: 'Pulse' },
    { id: 'nuage' as const,            label: 'Nuage de mots',   icon: Cloud,         desc: 'Mots-cles anonymes', category: 'Pulse' },
    { id: 'echelle' as const,          label: 'Echelle',         icon: Star,          desc: 'Note 1 a N', category: 'Pulse' },
    { id: 'question_ouverte' as const, label: 'Question ouverte',icon: FileText,      desc: 'Reponse longue', category: 'Pulse' },
    { id: 'sondage' as const,          label: 'Sondage',         icon: BarChart,      desc: 'Choix parmi options', category: 'Pulse' },
    { id: 'humeur' as const,           label: 'Humeur',          icon: Smile,         desc: 'Emoji ressenti', category: 'Pulse' },
    { id: 'priorite' as const,         label: 'Priorite',        icon: ArrowUpDown,   desc: 'Classer des items', category: 'Pulse' },
    { id: 'matrice' as const,          label: 'Matrice',         icon: Grid3X3,       desc: 'Noter des criteres', category: 'Pulse' },
    // Code
    { id: 'live_code' as const,        label: 'Live Code',        icon: Code2,        desc: 'Coder en direct', category: 'Code' },
    // Board
    { id: 'board' as const,            label: 'Tableau',          icon: StickyNote,   desc: 'Post-its collaboratifs', category: 'Board' },
  ]

  const CATEGORY_META: Record<string, { label: string; desc: string; color: string }> = {
    Spark: { label: 'Spark', desc: 'Quiz gamifie avec scoring', color: '#f59e0b' },
    Pulse: { label: 'Pulse', desc: 'Feedback anonyme', color: '#10b981' },
    Code:  { label: 'Code',  desc: 'Live coding', color: '#3b82f6' },
    Board: { label: 'Board', desc: 'Brainstorming', color: '#a855f7' },
  }

  const categories = computed(() => {
    const grouped = new Map<string, typeof typeCards>()
    for (const card of typeCards) {
      if (!grouped.has(card.category)) grouped.set(card.category, [])
      grouped.get(card.category)!.push(card)
    }
    return [...grouped.entries()].map(([name, cards]) => ({
      name,
      meta: CATEGORY_META[name],
      cards,
    }))
  })

  // Code activity
  const codeLanguage = ref(props.initialData?.language ?? 'javascript')
  // Board activity
  const boardColumns = ref<string[]>(parseBoardColumns(props.initialData))

  // Pulse activities
  const maxWords = ref(props.initialData?.max_words ?? 2)
  const maxRating = ref(props.initialData?.max_rating ?? 5)
  const sondageOptions = ref<string[]>(props.initialData?.type === 'sondage' ? parsePulseOptions(props.initialData) : ['', ''])
  const prioriteItems = ref<string[]>(props.initialData?.type === 'priorite' ? parsePulseOptions(props.initialData) : ['', '', ''])
  const matriceCriteria = ref<string[]>(props.initialData?.type === 'matrice' ? parsePulseOptions(props.initialData) : ['', ''])

  function parsePulseOptions(data?: LiveActivity | null): string[] {
    if (!data?.options) return ['', '']
    try { const arr = JSON.parse(data.options as unknown as string); return Array.isArray(arr) ? arr : ['', ''] } catch { return ['', ''] }
  }

  function addSondageOption() { if (sondageOptions.value.length < 8) sondageOptions.value.push('') }
  function removeSondageOption(i: number) { if (sondageOptions.value.length > 2) sondageOptions.value = sondageOptions.value.filter((_, idx) => idx !== i) }
  function addPrioriteItem() { if (prioriteItems.value.length < 8) prioriteItems.value.push('') }
  function removePrioriteItem(i: number) { if (prioriteItems.value.length > 2) prioriteItems.value = prioriteItems.value.filter((_, idx) => idx !== i) }
  function addMatriceCrit() { if (matriceCriteria.value.length < 8) matriceCriteria.value.push('') }
  function removeMatriceCrit(i: number) { if (matriceCriteria.value.length > 2) matriceCriteria.value = matriceCriteria.value.filter((_, idx) => idx !== i) }

  function parseBoardColumns(data?: LiveActivity | null): string[] {
    if (!data || data.type !== 'board' || !data.options) return ['Idees', 'A approfondir', 'A ecarter']
    try { const arr = JSON.parse(data.options as unknown as string); return Array.isArray(arr) ? arr : ['Idees', 'A approfondir', 'A ecarter'] } catch { return ['Idees', 'A approfondir', 'A ecarter'] }
  }

  function addBoardColumn() { if (boardColumns.value.length < 6) boardColumns.value.push('') }
  function removeBoardColumn(i: number) { if (boardColumns.value.length > 1) boardColumns.value = boardColumns.value.filter((_, idx) => idx !== i) }

  function addOption() {
    if (options.value.length < 6) options.value.push('')
  }

  function removeOption(i: number) {
    if (options.value.length > 2) {
      options.value.splice(i, 1)
      // Adjust correctAnswers indices
      correctAnswers.value = correctAnswers.value
        .filter(idx => idx !== i)
        .map(idx => idx > i ? idx - 1 : idx)
    }
  }

  function toggleCorrect(i: number) {
    const idx = correctAnswers.value.indexOf(i)
    if (idx >= 0) correctAnswers.value.splice(idx, 1)
    else correctAnswers.value.push(i)
  }

  function addAccepted() { if (acceptedAnswers.value.length < 10) acceptedAnswers.value.push('') }
  function removeAccepted(i: number) { if (acceptedAnswers.value.length > 1) acceptedAnswers.value = acceptedAnswers.value.filter((_, idx) => idx !== i) }
  function addPair() { if (pairs.value.length < 8) pairs.value = [...pairs.value, { left: '', right: '' }] }
  function removePair(i: number) { if (pairs.value.length > 2) pairs.value = pairs.value.filter((_, idx) => idx !== i) }

  function save() {
    if (!title.value.trim()) return
    const payload: {
      type: ActivityType; title: string
      options?: string[] | string; max_words?: number; max_rating?: number
      timer_seconds?: number; correct_answers?: number[] | string[]
      language?: string
    } = {
      type: activityType.value,
      title: title.value.trim(),
      timer_seconds: timerSeconds.value,
    }
    if (activityType.value === 'qcm') {
      const filtered = options.value.map(o => o.trim()).filter(Boolean)
      if (filtered.length < 2) return
      payload.options = filtered
      if (correctAnswers.value.length > 0) {
        payload.correct_answers = correctAnswers.value.filter(i => i < filtered.length)
      }
    }
    if (activityType.value === 'vrai_faux') {
      payload.options = ['Vrai', 'Faux']
      payload.correct_answers = [vraiFauxCorrect.value]
    }
    if (activityType.value === 'reponse_courte') {
      const filtered = acceptedAnswers.value.map(a => a.trim()).filter(Boolean)
      if (filtered.length === 0) return
      payload.correct_answers = filtered
    }
    if (activityType.value === 'association') {
      const valid = pairs.value.filter(p => p.left.trim() && p.right.trim())
      if (valid.length < 2) return
      payload.correct_answers = valid as unknown as string[]
    }
    if (activityType.value === 'estimation') {
      const t = Number(estimation.value.target)
      if (isNaN(t)) return
      const m = Math.max(0, Number(estimation.value.margin) || 0)
      payload.correct_answers = { target: t, margin: m } as unknown as string[]
    }
    if (activityType.value === 'live_code') {
      payload.language = codeLanguage.value
    }
    if (activityType.value === 'board') {
      const cols = boardColumns.value.map(c => c.trim()).filter(Boolean)
      if (cols.length === 0) return
      payload.options = JSON.stringify(cols)
    }
    // ── Pulse types ────────────────────────────────────────────────────
    if (activityType.value === 'nuage') {
      payload.max_words = maxWords.value
    }
    if (activityType.value === 'echelle') {
      payload.max_rating = maxRating.value
    }
    if (activityType.value === 'sondage' && activityType.value !== 'sondage') {
      // Placeholder, handled below
    }
    if (activityType.value === 'sondage') {
      const filtered = sondageOptions.value.map(o => o.trim()).filter(Boolean)
      if (filtered.length < 2) return
      payload.options = JSON.stringify(filtered)
    }
    if (activityType.value === 'humeur') {
      payload.options = JSON.stringify(HUMEUR_EMOJIS)
    }
    if (activityType.value === 'priorite') {
      const filtered = prioriteItems.value.map(o => o.trim()).filter(Boolean)
      if (filtered.length < 2) return
      payload.options = JSON.stringify(filtered)
    }
    if (activityType.value === 'matrice') {
      const filtered = matriceCriteria.value.map(o => o.trim()).filter(Boolean)
      if (filtered.length < 2) return
      payload.options = JSON.stringify(filtered)
      payload.max_rating = maxRating.value
    }
    emit('save', payload)
  }
</script>

<template>
  <div class="activity-form">
    <h3 class="form-title">{{ isEditing ? 'Modifier l\'activité' : 'Nouvelle activité' }}</h3>

    <!-- Type selector grouped by category -->
    <div v-for="cat in categories" :key="cat.name" class="type-category">
      <div class="type-category-header">
        <span class="type-category-dot" :style="{ background: cat.meta?.color }" />
        <span class="type-category-label">{{ cat.meta?.label ?? cat.name }}</span>
        <span class="type-category-desc">{{ cat.meta?.desc ?? '' }}</span>
      </div>
      <div class="type-cards">
        <button
          v-for="t in cat.cards"
          :key="t.id"
          class="type-card"
          :class="{ active: activityType === t.id }"
          :style="{ '--cat-color': cat.meta?.color ?? 'var(--accent)' }"
          @click="activityType = t.id"
        >
          <component :is="t.icon" :size="22" />
          <span class="type-card-label">{{ t.label }}</span>
          <span class="type-card-desc">{{ t.desc }}</span>
        </button>
      </div>
    </div>

    <!-- Title -->
    <input
      v-model="title"
      class="form-input"
      placeholder="Question ou titre de l'activité"
      maxlength="200"
    />

    <!-- Timer selector (spark uniquement, pas pulse/code/board) -->
    <div v-if="['qcm','vrai_faux','reponse_courte','association','estimation'].includes(activityType)" class="timer-section">
      <label class="timer-label">Chronometre</label>
      <div class="timer-btns">
        <button
          v-for="t in timerOptions"
          :key="t"
          class="timer-btn"
          :class="{ active: timerSeconds === t }"
          @click="timerSeconds = t"
        >
          {{ t >= 60 ? `${t / 60}m` : `${t}s` }}
        </button>
      </div>
    </div>

    <!-- QCM options -->
    <div v-if="activityType === 'qcm'" class="options-section">
      <label class="correct-label">Options (cochez les bonnes reponses)</label>
      <div v-for="(opt, i) in options" :key="i" class="option-row">
        <button
          class="correct-toggle"
          :class="{ checked: correctAnswers.includes(i) }"
          title="Marquer comme bonne reponse"
          @click="toggleCorrect(i)"
        >
          <span class="correct-check">&#x2713;</span>
        </button>
        <input
          v-model="options[i]"
          class="form-input option-input"
          :placeholder="`Option ${i + 1}`"
          maxlength="100"
        />
        <button
          v-if="options.length > 2"
          class="option-remove"
          @click="removeOption(i)"
        >
          <X :size="14" />
        </button>
      </div>
      <button v-if="options.length < 6" class="add-option-btn" @click="addOption">
        <Plus :size="14" />
        Ajouter une option
      </button>
    </div>

    <!-- Vrai/Faux correct answer -->
    <div v-if="activityType === 'vrai_faux'" class="vf-section">
      <label class="correct-label">La bonne reponse est :</label>
      <div class="vf-toggle">
        <button class="vf-btn vf-vrai" :class="{ active: vraiFauxCorrect === 0 }" @click="vraiFauxCorrect = 0">Vrai</button>
        <button class="vf-btn vf-faux" :class="{ active: vraiFauxCorrect === 1 }" @click="vraiFauxCorrect = 1">Faux</button>
      </div>
    </div>

    <!-- Reponse courte accepted answers -->
    <div v-if="activityType === 'reponse_courte'" class="accepted-section">
      <label class="correct-label">Reponses acceptees (tolerant aux fautes)</label>
      <div v-for="(_, i) in acceptedAnswers" :key="i" class="option-row">
        <input v-model="acceptedAnswers[i]" class="form-input option-input" :placeholder="`Reponse ${i + 1}`" maxlength="100" />
        <button v-if="acceptedAnswers.length > 1" class="option-remove" @click="removeAccepted(i)"><X :size="14" /></button>
      </div>
      <button v-if="acceptedAnswers.length < 10" class="add-option-btn" @click="addAccepted">
        <Plus :size="14" /> Ajouter une reponse
      </button>
    </div>

    <!-- Association pairs -->
    <div v-if="activityType === 'association'" class="accepted-section">
      <label class="correct-label">Paires a associer</label>
      <div v-for="(p, i) in pairs" :key="i" class="pair-row">
        <input v-model="pairs[i].left" class="form-input pair-input" :placeholder="`Gauche ${i + 1}`" maxlength="80" />
        <span class="pair-arrow">&rarr;</span>
        <input v-model="pairs[i].right" class="form-input pair-input" :placeholder="`Droite ${i + 1}`" maxlength="80" />
        <button v-if="pairs.length > 2" class="option-remove" @click="removePair(i)"><X :size="14" /></button>
      </div>
      <button v-if="pairs.length < 8" class="add-option-btn" @click="addPair">
        <Plus :size="14" /> Ajouter une paire
      </button>
    </div>

    <!-- ── Pulse : Nuage (max_words) ──────────────────────────────────── -->
    <div v-if="activityType === 'nuage'" class="code-section">
      <label class="correct-label">Nombre de mots max par reponse</label>
      <div class="timer-btns">
        <button v-for="n in [1, 2, 3]" :key="n" class="timer-btn" :class="{ active: maxWords === n }" @click="maxWords = n">{{ n }}</button>
      </div>
    </div>

    <!-- ── Pulse : Echelle / Matrice (max_rating) ─────────────────────── -->
    <div v-if="activityType === 'echelle' || activityType === 'matrice'" class="code-section">
      <label class="correct-label">Type d'echelle</label>
      <div class="timer-btns">
        <button class="timer-btn" :class="{ active: maxRating === 5 }" @click="maxRating = 5">5 etoiles</button>
        <button class="timer-btn" :class="{ active: maxRating === 10 }" @click="maxRating = 10">Slider 1-10</button>
      </div>
    </div>

    <!-- ── Pulse : Sondage options ──────────────────────────────────── -->
    <div v-if="activityType === 'sondage'" class="code-section">
      <label class="correct-label">Options du sondage</label>
      <div v-for="(_, i) in sondageOptions" :key="i" class="option-row">
        <input v-model="sondageOptions[i]" class="form-input option-input" :placeholder="`Option ${i + 1}`" maxlength="100" />
        <button v-if="sondageOptions.length > 2" class="option-remove" @click="removeSondageOption(i)"><X :size="12" /></button>
      </div>
      <button v-if="sondageOptions.length < 8" class="add-option-btn" @click="addSondageOption"><Plus :size="13" /> Option</button>
    </div>

    <!-- ── Pulse : Priorite items ──────────────────────────────────── -->
    <div v-if="activityType === 'priorite'" class="code-section">
      <label class="correct-label">Items a classer</label>
      <div v-for="(_, i) in prioriteItems" :key="i" class="option-row">
        <input v-model="prioriteItems[i]" class="form-input option-input" :placeholder="`Item ${i + 1}`" maxlength="100" />
        <button v-if="prioriteItems.length > 2" class="option-remove" @click="removePrioriteItem(i)"><X :size="12" /></button>
      </div>
      <button v-if="prioriteItems.length < 8" class="add-option-btn" @click="addPrioriteItem"><Plus :size="13" /> Item</button>
    </div>

    <!-- ── Pulse : Matrice criteres ──────────────────────────────────── -->
    <div v-if="activityType === 'matrice'" class="code-section">
      <label class="correct-label">Criteres a evaluer</label>
      <div v-for="(_, i) in matriceCriteria" :key="i" class="option-row">
        <input v-model="matriceCriteria[i]" class="form-input option-input" :placeholder="`Critere ${i + 1}`" maxlength="100" />
        <button v-if="matriceCriteria.length > 2" class="option-remove" @click="removeMatriceCrit(i)"><X :size="12" /></button>
      </div>
      <button v-if="matriceCriteria.length < 8" class="add-option-btn" @click="addMatriceCrit"><Plus :size="13" /> Critere</button>
    </div>

    <!-- ── Pulse : Humeur (info only, emojis fixes) ──────────────────── -->
    <div v-if="activityType === 'humeur'" class="code-section">
      <label class="correct-label">Emojis disponibles pour les etudiants</label>
      <div class="humeur-preview">
        <span v-for="e in HUMEUR_EMOJIS" :key="e" class="humeur-emoji">{{ e }}</span>
      </div>
      <p class="code-hint">Les etudiants choisissent un emoji pour exprimer leur ressenti. Anonyme.</p>
    </div>

    <!-- Live Code : language selector -->
    <div v-if="activityType === 'live_code'" class="code-section">
      <label class="correct-label">Langage de programmation</label>
      <select v-model="codeLanguage" class="form-input">
        <option value="javascript">JavaScript</option>
        <option value="python">Python</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="sql">SQL</option>
        <option value="plaintext">Texte brut</option>
      </select>
      <p class="code-hint">
        Vous ecrirez du code en direct. Les etudiants verront votre ecran en lecture seule.
      </p>
    </div>

    <!-- Board : colonnes -->
    <div v-if="activityType === 'board'" class="board-section">
      <label class="correct-label">Colonnes du tableau</label>
      <div v-for="(col, i) in boardColumns" :key="i" class="option-row">
        <input
          v-model="boardColumns[i]"
          class="form-input option-input"
          :placeholder="`Colonne ${i + 1}`"
          maxlength="50"
        />
        <button
          v-if="boardColumns.length > 1"
          class="option-remove"
          @click="removeBoardColumn(i)"
        >
          <X :size="12" />
        </button>
      </div>
      <button v-if="boardColumns.length < 6" class="add-option-btn" @click="addBoardColumn">
        <Plus :size="13" /> Ajouter une colonne
      </button>
      <p class="code-hint">
        Les etudiants pourront ajouter des post-its et voter pour les idees.
      </p>
    </div>

    <!-- Estimation target + margin -->
    <div v-if="activityType === 'estimation'" class="estimation-section">
      <label class="correct-label">Reponse attendue</label>
      <div class="estimation-fields">
        <div class="estimation-field">
          <label class="estimation-label">Valeur cible</label>
          <input v-model="estimation.target" class="form-input" type="number" step="any" placeholder="Ex: 3.14" />
        </div>
        <div class="estimation-field">
          <label class="estimation-label">Marge de tolerance</label>
          <input v-model="estimation.margin" class="form-input" type="number" step="any" min="0" placeholder="Ex: 0.1" />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button class="btn-cancel" @click="emit('cancel')">Annuler</button>
      <button class="btn-save" :disabled="!title.trim()" @click="save">{{ isEditing ? 'Enregistrer' : 'Ajouter' }}</button>
    </div>
  </div>
</template>

<style scoped>
.activity-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

/* Code + Board sections */
.code-section, .board-section {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-elevated);
}
.code-hint {
  font-size: 11px; color: var(--text-muted); font-style: italic;
  margin-top: 4px;
}
.humeur-preview {
  display: flex; gap: 10px; padding: 8px;
  background: var(--bg-input); border-radius: 6px;
}
.humeur-emoji { font-size: 28px; }

/* Category groups */
.type-category { margin-bottom: 12px; }
.type-category-header {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 8px; padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.type-category-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.type-category-label {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-primary);
}
.type-category-desc {
  font-size: 11px; color: var(--text-muted); margin-left: auto;
}

.type-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.type-card {
  flex: 1;
  min-width: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  color: var(--text-secondary, #aaa);
  cursor: pointer;
  transition: all .15s;
}
@media (max-width: 500px) {
  .type-card { min-width: 70px; padding: 10px 6px; }
  .type-category-header { flex-wrap: wrap; }
}
.type-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
}
.type-card.active {
  background: color-mix(in srgb, var(--cat-color, var(--accent)) 12%, transparent);
  border-color: var(--cat-color, var(--accent));
  color: var(--cat-color, var(--accent));
}
.type-card-label {
  font-size: 14px;
  font-weight: 700;
}
.type-card-desc {
  font-size: 11px;
  color: var(--text-muted);
}
.type-card.active .type-card-desc {
  color: var(--accent);
  opacity: .7;
}
.form-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-input, var(--border));
  border: 1px solid var(--border-input, var(--bg-hover));
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color .15s;
}
.form-input:focus {
  border-color: var(--accent);
}
.timer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.timer-label {
  font-size: 13px;
  color: var(--text-secondary, #aaa);
  font-weight: 600;
}
.timer-btns {
  display: flex;
  gap: 8px;
}
.timer-btn {
  flex: 1;
  height: 44px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  background: var(--bg-hover);
  border: 2px solid var(--border);
  color: var(--text-secondary, #aaa);
  cursor: pointer;
  transition: all .15s;
}
.timer-btn.active {
  background: var(--accent-subtle, rgba(74,144,217,.12));
  border-color: var(--accent);
  color: var(--accent);
}
.correct-label {
  font-size: 13px;
  color: var(--text-secondary, #aaa);
  font-weight: 600;
  margin-bottom: 2px;
}
.correct-toggle {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: var(--bg-hover);
  border: 2px solid var(--border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all .15s;
}
.correct-toggle .correct-check {
  opacity: 0;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  transition: opacity .15s;
}
.correct-toggle.checked {
  background: #22c55e;
  border-color: #16a34a;
}
.correct-toggle.checked .correct-check {
  opacity: 1;
}
.options-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.option-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.option-input {
  flex: 1;
}
.option-remove {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(239,68,68,.1);
  border: none;
  color: #f87171;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .15s;
  flex-shrink: 0;
}
.option-remove:hover {
  background: rgba(239,68,68,.2);
}
.add-option-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px dashed var(--border-input);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all .15s;
}
.add-option-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary, #aaa);
}
.max-words-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.max-words-label {
  font-size: 13px;
  color: var(--text-secondary, #aaa);
  font-weight: 600;
}
.max-words-btns {
  display: flex;
  gap: 8px;
}
.max-words-btn {
  width: 48px;
  height: 40px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  background: var(--bg-hover);
  border: 2px solid var(--border);
  color: var(--text-secondary, #aaa);
  cursor: pointer;
  transition: all .15s;
}
.max-words-btn.active {
  background: var(--accent-subtle, rgba(74,144,217,.12));
  border-color: var(--accent);
  color: var(--accent);
}
.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.btn-cancel {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-secondary, #aaa);
  cursor: pointer;
  transition: all .15s;
}
.btn-cancel:hover {
  background: var(--bg-elevated);
}
.btn-save {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: var(--accent);
  border: none;
  color: #fff;
  cursor: pointer;
  transition: all .15s;
}
.btn-save:hover {
  filter: brightness(1.1);
}
.btn-save:disabled {
  opacity: .4;
  cursor: not-allowed;
}
/* Vrai/Faux toggle */
.vf-section { display: flex; flex-direction: column; gap: 8px; }
.vf-toggle { display: flex; gap: 10px; }
.vf-btn { flex: 1; padding: 14px; border-radius: 8px; font-size: 15px; font-weight: 700; border: 2px solid var(--border); background: var(--bg-elevated); color: var(--text-secondary); cursor: pointer; transition: all .15s; }
.vf-vrai.active { background: #22c55e22; border-color: #22c55e; color: #22c55e; }
.vf-faux.active { background: #ef444422; border-color: #ef4444; color: #ef4444; }
/* Accepted answers (reponse courte) */
.accepted-section { display: flex; flex-direction: column; gap: 8px; }
/* Association pairs */
.pair-row { display: flex; align-items: center; gap: 8px; }
.pair-input { flex: 1; }
.pair-arrow { color: var(--text-secondary); font-size: 16px; flex-shrink: 0; }
/* Estimation */
.estimation-section { display: flex; flex-direction: column; gap: 8px; }
.estimation-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.estimation-field { display: flex; flex-direction: column; gap: 4px; }
.estimation-label { font-size: 12px; color: var(--text-secondary); }
</style>
