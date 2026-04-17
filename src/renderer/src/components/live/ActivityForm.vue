<!-- ActivityForm.vue - Formulaire de création/édition d'activité Live (QCM / Sondage / Nuage) -->
<script setup lang="ts">
  import { ref, computed, watch, type Component } from 'vue'
  import {
    ListChecks, ToggleLeft, Type, Link2, Hash, Plus, X,
    Code2, StickyNote, MessageSquare, Cloud, Star, FileText,
    BarChart, Smile, ArrowUpDown, Grid3X3, TextCursorInput,
  } from 'lucide-vue-next'
  import type { LiveActivity, LiveV2ActivityType } from '@/types'
  import { ACTIVITY_CATEGORIES, HUMEUR_EMOJIS, type ActivityCategory } from '@/utils/liveActivity'

  const props = defineProps<{
    initialData?: LiveActivity | null
    defaultCategory?: ActivityCategory | null
    lockedCategory?: ActivityCategory | null
  }>()

  type ActivityType = LiveV2ActivityType

  const emit = defineEmits<{
    save: [payload: {
      type: ActivityType; title: string
      options?: string[] | string; max_words?: number; max_rating?: number
      timer_seconds?: number; correct_answers?: number[] | string[]
      language?: string
    }]
    cancel: []
  }>()

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

  // Texte a trous : le texte avec les blancs marques par {{mot}}
  function parseTexteATrous(data?: LiveActivity | null): { text: string; blanks: string[] } {
    if (!data || data.type !== 'texte_a_trous') return { text: '', blanks: [] }
    const text = data.title ?? ''
    try {
      const blanks = JSON.parse(data.correct_answers as unknown as string)
      return { text, blanks: Array.isArray(blanks) ? blanks : [] }
    } catch {
      return { text, blanks: [] }
    }
  }
  const texteATrous = ref(parseTexteATrous(props.initialData))
  const texteATrousBlanks = computed(() => {
    const matches = texteATrous.value.text.match(/\{\{([^}]+)\}\}/g) || []
    return matches.map(m => m.slice(2, -2))
  })
  const title        = ref(props.initialData?.title ?? '')
  const options      = ref<string[]>(parseOptions(props.initialData))
  const timerSeconds = ref(props.initialData?.timer_seconds ?? 30)
  const correctAnswers = ref<number[]>(parseCorrectAnswers(props.initialData))
  const timerOptions = [10, 15, 20, 30, 45, 60, 90, 120]

  // Typage fort : category == clef ACTIVITY_CATEGORIES (source unique de verite).
  const typeCards: { id: ActivityType; label: string; icon: Component; desc: string; category: ActivityCategory }[] = [
    // Spark
    { id: 'qcm',              label: 'QCM',              icon: ListChecks,    desc: 'Choix multiple',        category: 'spark' },
    { id: 'vrai_faux',        label: 'Vrai / Faux',      icon: ToggleLeft,    desc: 'Question binaire',      category: 'spark' },
    { id: 'reponse_courte',   label: 'Réponse courte',   icon: Type,          desc: 'Texte libre noté',      category: 'spark' },
    { id: 'association',      label: 'Association',      icon: Link2,         desc: 'Relier les paires',     category: 'spark' },
    { id: 'estimation',       label: 'Estimation',       icon: Hash,          desc: 'Réponse numérique',     category: 'spark' },
    { id: 'texte_a_trous',    label: 'Texte a trous',    icon: TextCursorInput, desc: 'Remplir les blancs',  category: 'spark' },
    { id: 'tri',              label: 'Tri (ordre)',      icon: ArrowUpDown,     desc: 'Remettre dans l\'ordre', category: 'spark' },
    // Pulse
    { id: 'sondage_libre',    label: 'Sondage libre',    icon: MessageSquare, desc: 'Texte libre anonyme',   category: 'pulse' },
    { id: 'nuage',            label: 'Nuage de mots',    icon: Cloud,         desc: 'Mots-cles anonymes',    category: 'pulse' },
    { id: 'echelle',          label: 'Echelle',          icon: Star,          desc: 'Note 1 a N',            category: 'pulse' },
    { id: 'question_ouverte', label: 'Question ouverte', icon: FileText,      desc: 'Reponse longue',        category: 'pulse' },
    { id: 'sondage',          label: 'Sondage',          icon: BarChart,      desc: 'Choix parmi options',   category: 'pulse' },
    { id: 'humeur',           label: 'Humeur',           icon: Smile,         desc: 'Emoji ressenti',        category: 'pulse' },
    { id: 'priorite',         label: 'Priorite',         icon: ArrowUpDown,   desc: 'Classer des items',     category: 'pulse' },
    { id: 'matrice',          label: 'Matrice',          icon: Grid3X3,       desc: 'Noter des criteres',    category: 'pulse' },
    // Code / Board
    { id: 'live_code',        label: 'Live Code',        icon: Code2,         desc: 'Coder en direct',       category: 'code' },
    { id: 'board',            label: 'Tableau',          icon: StickyNote,    desc: 'Post-its collaboratifs', category: 'board' },
    { id: 'message_wall',     label: 'Mur de messages',  icon: MessageSquare, desc: 'Messages + likes',       category: 'board' },
  ]

  const categories = computed(() => {
    const grouped = new Map<ActivityCategory, typeof typeCards>()
    for (const card of typeCards) {
      if (!grouped.has(card.category)) grouped.set(card.category, [])
      grouped.get(card.category)!.push(card)
    }
    let all = [...grouped.entries()].map(([key, cards]) => ({
      key,
      meta: ACTIVITY_CATEGORIES[key],
      cards,
    }))
    if (props.lockedCategory && !isEditing) {
      return all.filter(c => c.key === props.lockedCategory)
    }
    if (props.defaultCategory) {
      const idx = all.findIndex(c => c.key === props.defaultCategory)
      if (idx > 0) {
        const [cat] = all.splice(idx, 1)
        all.unshift(cat)
      }
    }
    return all
  })

  // Si la categorie verrouillee change, s'assurer que activityType y appartient.
  // watch plutot que watchEffect : evite le self-retrigger quand on ecrit activityType.value.
  watch(() => props.lockedCategory, (locked) => {
    if (!locked || isEditing) return
    const allowed = typeCards.filter(c => c.category === locked).map(c => c.id)
    if (allowed.length && !allowed.includes(activityType.value)) {
      activityType.value = allowed[0]
    }
  }, { immediate: true })

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

  const boardMaxVotes = ref(props.initialData?.type === 'board' ? (props.initialData?.max_rating ?? 3) : 3)

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

  const validationError = ref<string | null>(null)

  function fail(msg: string): false {
    validationError.value = msg
    return false
  }

  function save() {
    validationError.value = null
    const trimmedTitle = title.value.trim()
    if (!trimmedTitle) { fail('Donnez un titre à la question.'); return }

    const payload: {
      type: ActivityType; title: string
      options?: string[] | string; max_words?: number; max_rating?: number
      timer_seconds?: number; correct_answers?: number[] | string[]
      language?: string
    } = {
      type: activityType.value,
      title: trimmedTitle,
      timer_seconds: timerSeconds.value,
    }

    switch (activityType.value) {
      case 'qcm': {
        const filtered = options.value.map(o => o.trim()).filter(Boolean)
        if (filtered.length < 2) { fail('Au moins deux options sont requises.'); return }
        if (new Set(filtered).size !== filtered.length) { fail('Deux options ont le même libellé.'); return }
        payload.options = filtered
        if (correctAnswers.value.length > 0) {
          payload.correct_answers = correctAnswers.value.filter(i => i < filtered.length)
        }
        break
      }
      case 'vrai_faux':
        payload.options = ['Vrai', 'Faux']
        payload.correct_answers = [vraiFauxCorrect.value]
        break
      case 'reponse_courte': {
        const filtered = acceptedAnswers.value.map(a => a.trim()).filter(Boolean)
        if (filtered.length === 0) { fail('Indiquez au moins une réponse acceptée.'); return }
        payload.correct_answers = filtered
        break
      }
      case 'association': {
        const valid = pairs.value.filter(p => p.left.trim() && p.right.trim())
        if (valid.length < 2) { fail('Au moins deux paires complètes sont requises.'); return }
        payload.correct_answers = valid as unknown as string[]
        break
      }
      case 'estimation': {
        const t = Number(estimation.value.target)
        if (isNaN(t)) { fail('La valeur cible doit être un nombre.'); return }
        const m = Math.max(0, Number(estimation.value.margin) || 0)
        payload.correct_answers = { target: t, margin: m } as unknown as string[]
        break
      }
      case 'texte_a_trous': {
        if (texteATrousBlanks.value.length === 0) { fail('Le texte doit contenir au moins un trou marque par {{mot}}.'); return }
        // Le titre est le texte complet avec les {{...}} — il sert a la fois d'enonce et de source des trous
        payload.title = texteATrous.value.text || trimmedTitle
        payload.correct_answers = texteATrousBlanks.value as unknown as string[]
        break
      }
      case 'tri': {
        // Reuse prioriteItems for tri items (same UI)
        const filtered = prioriteItems.value.map(o => o.trim()).filter(Boolean)
        if (filtered.length < 2) { fail('Au moins deux items a ordonner sont requis.'); return }
        payload.options = JSON.stringify(filtered)
        // L'ordre correct est l'ordre dans lequel le prof les a saisis : [0,1,2,...]
        payload.correct_answers = filtered.map((_, i) => i) as unknown as string[]
        break
      }
      case 'live_code':
        payload.language = codeLanguage.value
        break
      case 'board': {
        const cols = boardColumns.value.map(c => c.trim()).filter(Boolean)
        if (cols.length === 0) { fail('Ajoutez au moins une colonne.'); return }
        payload.options = JSON.stringify(cols)
        payload.max_rating = boardMaxVotes.value
        break
      }
      case 'nuage':
        payload.max_words = maxWords.value
        break
      case 'echelle':
        payload.max_rating = maxRating.value
        break
      case 'sondage': {
        const filtered = sondageOptions.value.map(o => o.trim()).filter(Boolean)
        if (filtered.length < 2) { fail('Au moins deux options sont requises.'); return }
        payload.options = JSON.stringify(filtered)
        break
      }
      case 'humeur':
        payload.options = JSON.stringify(HUMEUR_EMOJIS)
        break
      case 'priorite': {
        const filtered = prioriteItems.value.map(o => o.trim()).filter(Boolean)
        if (filtered.length < 2) { fail('Au moins deux items à classer sont requis.'); return }
        payload.options = JSON.stringify(filtered)
        break
      }
      case 'matrice': {
        const filtered = matriceCriteria.value.map(o => o.trim()).filter(Boolean)
        if (filtered.length < 2) { fail('Au moins deux critères sont requis.'); return }
        payload.options = JSON.stringify(filtered)
        payload.max_rating = maxRating.value
        break
      }
      // 'sondage_libre' + 'question_ouverte' : rien a valider au-dela du titre
    }
    emit('save', payload)
  }
</script>

<template>
  <div class="activity-form">
    <h3 class="form-title">
      {{ isEditing ? 'Modifier l\'activité' : 'Nouvelle activité' }}
      <span
        v-if="lockedCategory && !isEditing"
        class="form-scope-badge"
        :style="{ '--cat-color': ACTIVITY_CATEGORIES[lockedCategory].color }"
      >
        {{ ACTIVITY_CATEGORIES[lockedCategory].label }} uniquement
      </span>
    </h3>

    <!-- Type selector grouped by category -->
    <div v-for="cat in categories" :key="cat.key" class="type-category">
      <div class="type-category-header">
        <span class="type-category-dot" :style="{ background: cat.meta.color }" />
        <span class="type-category-label">{{ cat.meta.label }}</span>
        <span class="type-category-desc">{{ cat.meta.description }}</span>
      </div>
      <div class="type-cards">
        <button
          v-for="t in cat.cards"
          :key="t.id"
          class="type-card"
          :class="{ active: activityType === t.id }"
          :style="{ '--cat-color': cat.meta.color }"
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

    <!-- ── Spark : Tri (sorting) items ──────────────────────────────── -->
    <div v-if="activityType === 'tri'" class="code-section">
      <label class="correct-label">Items dans le bon ordre</label>
      <p class="form-hint">Saisissez les items dans l'ordre correct. Les etudiants les recevront melanges.</p>
      <div v-for="(_, i) in prioriteItems" :key="i" class="option-row">
        <span class="tatrous-blank-chip">{{ i + 1 }}</span>
        <input v-model="prioriteItems[i]" class="form-input option-input" :placeholder="`Etape ${i + 1}`" maxlength="100" />
        <button v-if="prioriteItems.length > 2" class="option-remove" @click="removePrioriteItem(i)"><X :size="12" /></button>
      </div>
      <button v-if="prioriteItems.length < 10" class="add-option-btn" @click="addPrioriteItem"><Plus :size="13" /> Item</button>
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
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="sql">SQL</option>
        <option value="markdown">Markdown</option>
        <option value="json">JSON</option>
        <option value="java">Java</option>
        <option value="cpp">C / C++</option>
        <option value="plaintext">Texte brut</option>
      </select>
      <p class="code-hint">
        Vous ecrirez du code en direct. Les etudiants verront votre ecran en lecture seule
        avec coloration syntaxique complete.
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
      <label class="correct-label" style="margin-top:8px">Votes par personne</label>
      <div class="timer-btns">
        <button v-for="n in [1, 2, 3, 5]" :key="n" class="timer-btn" :class="{ active: boardMaxVotes === n }" @click="boardMaxVotes = n">{{ n }}</button>
      </div>
      <p class="code-hint">
        Les etudiants pourront ajouter des post-its et voter pour les idees ({{ boardMaxVotes }} vote{{ boardMaxVotes > 1 ? 's' : '' }} chacun).
      </p>
    </div>

    <!-- Texte a trous -->
    <div v-if="activityType === 'texte_a_trous'" class="accepted-section">
      <label class="correct-label">Texte avec trous</label>
      <p class="form-hint">Utilisez <code v-pre>{{mot}}</code> pour marquer les trous. Exemple : <span v-pre>Le {{soleil}} brille dans le {{ciel}}.</span></p>
      <textarea
        v-model="texteATrous.text"
        class="form-input"
        rows="4"
        placeholder="La capitale de la France est {{Paris}} et elle se situe en {{Europe}}."
        style="resize: vertical"
      />
      <div v-if="texteATrousBlanks.length > 0" class="tatrous-preview">
        <span class="tatrous-preview-label">Trous detectes :</span>
        <span v-for="(blank, i) in texteATrousBlanks" :key="i" class="tatrous-blank-chip">{{ blank }}</span>
      </div>
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

    <!-- Banner validation -->
    <div v-if="validationError" class="form-error" role="alert" aria-live="polite">
      <span class="form-error-icon" aria-hidden="true">!</span>
      <span>{{ validationError }}</span>
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
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.form-scope-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--cat-color, var(--accent));
  background: color-mix(in srgb, var(--cat-color, var(--accent)) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cat-color, var(--accent)) 40%, transparent);
}
.form-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 45%, transparent);
  color: color-mix(in srgb, var(--color-danger) 80%, #fff);
  font-size: 13px;
  font-weight: 500;
  animation: form-error-shake .3s cubic-bezier(.36,.07,.19,.97);
}
.form-error-icon {
  flex-shrink: 0;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--color-danger);
  color: #fff;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}
@keyframes form-error-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
@media (prefers-reduced-motion: reduce) {
  .form-error { animation: none; }
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
/* Texte a trous */
.form-hint { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4; }
.form-hint code { background: var(--bg-tertiary); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
.tatrous-preview { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.tatrous-preview-label { font-size: 11px; color: var(--text-secondary); }
.tatrous-blank-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}
</style>
