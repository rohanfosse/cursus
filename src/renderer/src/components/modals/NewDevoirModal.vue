/**
 * Modale de création de devoir - formulaire adaptatif selon le type choisi.
 * Champs simplifiés avec smart defaults et descriptions contextuelles.
 */
<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import {
    FileText, Mic, Award, BookOpen, File, HelpCircle,
    Clock, MapPin, Calculator, FolderOpen, ChevronDown,
  } from 'lucide-vue-next'
  import { useAppStore }     from '@/stores/app'
  import { useTravauxStore } from '@/stores/travaux'
  import { useToast }        from '@/composables/useToast'
  import { useFormDraft }    from '@/composables/useFormDraft'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import Modal from '@/components/ui/Modal.vue'
  import DateTimePicker from '@/components/ui/DateTimePicker.vue'
  import { isoForDatetimeLocal } from '@/utils/date'
  import type { Component } from 'vue'
  import { COLORS, STORAGE_KEYS } from '@/constants'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  // ── Types ────────────────────────────────────────────────────────────────
  type DevoirType = 'cctl' | 'etude_de_cas' | 'soutenance' | 'livrable' | 'memoire' | 'autre'

  interface TypeOption {
    value: DevoirType
    label: string
    icon: Component
    desc: string
    color: string
  }

  const TYPE_OPTIONS: TypeOption[] = [
    { value: 'cctl',         label: 'CCTL',           icon: Award,    desc: 'Contrôle de connaissances en temps limité', color: COLORS.cctl },
    { value: 'etude_de_cas', label: 'Étude de cas',   icon: BookOpen, desc: 'Analyse et résolution en conditions d\'examen', color: COLORS.etudeDeCas },
    { value: 'soutenance',   label: 'Soutenance',     icon: Mic,      desc: 'Présentation orale devant un jury', color: COLORS.soutenance },
    { value: 'livrable',     label: 'Livrable',       icon: FileText, desc: 'Rendu de fichier avec une date limite', color: COLORS.livrable },
    { value: 'memoire',      label: 'Mémoire',        icon: File,     desc: 'Document long type rapport ou mémoire', color: COLORS.memoire },
    { value: 'autre',        label: 'Autre',          icon: HelpCircle, desc: 'Autre type de devoir', color: COLORS.autre },
  ]

  // ── Formulaire ──────────────────────────────────────────────────────────
  const type        = ref<DevoirType>('cctl')
  const title       = ref('')
  const description = ref('')
  const category    = ref('')
  const deadline    = ref(isoForDatetimeLocal())
  const startDate   = ref(isoForDatetimeLocal())
  const room        = ref('')
  const aavs        = ref('')
  const isDraft     = ref(false)
  const scheduledPublishAt = ref<string | null>(null)
  const channelId   = ref<number | null>(null)
  const channels    = ref<{ id: number; name: string }[]>([])
  const creating    = ref(false)

  const durationDays = computed(() => {
    if (!startDate.value || !deadline.value) return null
    const diff = new Date(deadline.value).getTime() - new Date(startDate.value).getTime()
    return diff > 0 ? Math.ceil(diff / 86_400_000) : null
  })
  const showAdvanced = ref(false)

  watch(scheduledPublishAt, (v) => { if (v) isDraft.value = true })

  // Champs structurés (événements)
  const duration      = ref<number | null>(20)
  const calculatrice  = ref(true)
  const ressources    = ref('Aucune')
  const session       = ref<'Initiale' | 'Rattrapage'>('Initiale')
  const requiresSubmission = ref(true)

  // ── Projets ─────────────────────────────────────────────────────────────
  const projects = computed(() => {
    if (!appStore.activePromoId) return []
    try {
      const raw = localStorage.getItem(`cc_projects_${appStore.activePromoId}`)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  // ── Computed ────────────────────────────────────────────────────────────
  const isEventType = computed(() => type.value === 'soutenance' || type.value === 'cctl' || type.value === 'etude_de_cas')
  const activeType  = computed(() => TYPE_OPTIONS.find(t => t.value === type.value)!)

  const canSubmit = computed(() =>
    title.value.trim().length > 0 && channelId.value != null && !creating.value,
  )

  // ── Brouillon auto-save (prof qui ferme accidentellement la modale ne perd rien) ──
  const draftKey = computed(() =>
    appStore.activePromoId ? STORAGE_KEYS.draftNewDevoir(appStore.activePromoId) : null,
  )
  const { justSaved, restore: restoreDraft, clear: clearDraft } = useFormDraft(draftKey.value, {
    title, description, category, deadline, startDate, room, aavs,
    duration, calculatrice, ressources, session, requiresSubmission,
  })

  // ── Init ────────────────────────────────────────────────────────────────
  watch(() => props.modelValue, async (open) => {
    if (!open || !appStore.activePromoId) return

    const chRes = await window.api.getChannels(appStore.activePromoId)
    channels.value = chRes?.ok ? chRes.data : []

    // Smart defaults
    category.value = appStore.activeProject ?? ''
    type.value = (appStore.pendingDevoirType as DevoirType) || 'cctl'
    appStore.pendingDevoirType = null

    // Auto-sélection du canal
    if (appStore.activeChannelId) {
      channelId.value = appStore.activeChannelId
    } else if (appStore.activeProject) {
      const projChannel = (channels.value as { id: number; name: string; category?: string }[])
        .find(c => c.category?.trim() === appStore.activeProject)
      channelId.value = projChannel?.id ?? channels.value[0]?.id ?? null
    } else {
      channelId.value = channels.value[0]?.id ?? null
    }

    // Reset
    title.value = ''
    description.value = ''
    room.value = ''
    aavs.value = ''
    isDraft.value = false
    showAdvanced.value = false
    deadline.value = startDate.value = isoForDatetimeLocal()
    duration.value = 20
    calculatrice.value = true
    ressources.value = 'Aucune'
    session.value = 'Initiale'
    requiresSubmission.value = true

    // Restaurer un brouillon existant (prof qui avait ferme la modale sans submit)
    restoreDraft()
  })

  // Adapter requiresSubmission quand le type change
  watch(type, (t) => {
    requiresSubmission.value = t === 'livrable' || t === 'memoire' || t === 'autre'
  })

  // ── Description auto ────────────────────────────────────────────────────
  function buildDescription(): string {
    if (!isEventType.value) return description.value.trim()
    const parts: string[] = []
    parts.push(`**Session ${session.value}**`)
    if (duration.value) parts.push(`Durée : ${duration.value} min`)
    if (calculatrice.value && type.value !== 'soutenance') parts.push('Calculatrice autorisée')
    else if (type.value !== 'soutenance') parts.push('Calculatrice non autorisée')
    if (type.value !== 'soutenance') {
      parts.push(ressources.value === 'Aucune' ? 'Aucune ressource autorisée' : `Ressources : ${ressources.value}`)
    }
    if (room.value.trim()) parts.push(`Salle : ${room.value.trim()}`)
    return parts.join('\n')
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function submit() {
    if (!canSubmit.value) return
    if (!channelId.value) {
      showToast('Veuillez sélectionner un canal (Options avancées).', 'error')
      showAdvanced.value = true
      return
    }
    creating.value = true
    try {
      if (!isEventType.value && startDate.value > deadline.value) {
        showToast('La date de début doit être avant la deadline.', 'error')
        return
      }
      const res = await travauxStore.createTravail({
        title:        title.value.trim(),
        description:  buildDescription() || null,
        type:         type.value,
        category:     category.value.trim() || null,
        deadline:     deadline.value,
        startDate:    isEventType.value ? null : startDate.value,
        published:    !isDraft.value,
        assigned_to:  'all',
        groupId:      null,
        channelId:    channelId.value,
        promoId:      appStore.activePromoId,
        room:         room.value.trim() || null,
        aavs:         aavs.value.trim() || null,
        requires_submission: requiresSubmission.value ? 1 : 0,
        scheduledPublishAt: scheduledPublishAt.value || null,
      })
      if (!res) { showToast('Erreur lors de la création.', 'error'); return }
      clearDraft()
      const msg = scheduledPublishAt.value
        ? 'Publication programmee.'
        : isDraft.value ? 'Brouillon enregistré.' : 'Devoir publié.'
      showToast(msg, 'success')
      emit('update:modelValue', false)
    } finally {
      creating.value = false
    }
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Nouveau devoir" max-width="560px" @update:model-value="emit('update:modelValue', $event)">
    <form class="nd" @submit.prevent="submit">

      <!-- ── Sélection du type ──────────────────────────────────────── -->
      <div class="nd-types">
        <button
          v-for="opt in TYPE_OPTIONS" :key="opt.value" type="button"
          class="nd-type-card"
          :class="{ active: type === opt.value }"
          :style="type === opt.value ? { borderColor: opt.color, background: opt.color + '0D' } : {}"
          @click="type = opt.value"
        >
          <component :is="opt.icon" :size="18" :style="{ color: type === opt.value ? opt.color : undefined }" />
          <span class="nd-type-label">{{ opt.label }}</span>
        </button>
      </div>

      <!-- Description du type sélectionné -->
      <p class="nd-type-desc" :style="{ color: activeType.color }">
        {{ activeType.desc }}
      </p>

      <!-- ── Titre ──────────────────────────────────────────────────── -->
      <div class="nd-field">
        <label class="nd-label">Titre</label>
        <input
          v-model="title" type="text" class="nd-input" required autofocus
          :placeholder="isEventType ? `ex : ${activeType.label} - Module X` : 'ex : Rapport final - Module X'"
        />
      </div>

      <!-- ═══ Champs ÉVÉNEMENT (CCTL / Soutenance / Étude de cas) ═══ -->
      <template v-if="isEventType">
        <div class="nd-row">
          <div class="nd-field nd-flex1">
            <DateTimePicker v-model="deadline" label="Date de l'epreuve" required :presets="false" />
          </div>
          <div class="nd-field nd-flex1">
            <label class="nd-label">Session</label>
            <select v-model="session" class="nd-input" aria-label="Session">
              <option value="Initiale">Initiale</option>
              <option value="Rattrapage">Rattrapage</option>
            </select>
          </div>
        </div>

        <div class="nd-row">
          <div class="nd-field nd-flex1">
            <label class="nd-label"><Clock :size="12" /> Durée</label>
            <select v-model.number="duration" class="nd-input" aria-label="Durée">
              <option :value="15">15 min</option>
              <option :value="20">20 min</option>
              <option :value="30">30 min</option>
              <option :value="45">45 min</option>
              <option :value="60">1h</option>
              <option :value="90">1h30</option>
              <option :value="120">2h</option>
              <option :value="180">3h</option>
            </select>
          </div>
          <div class="nd-field nd-flex1">
            <label class="nd-label"><MapPin :size="12" /> Salle</label>
            <input v-model="room" type="text" class="nd-input" placeholder="ex : B204" />
          </div>
        </div>

        <!-- Options examen (pas pour soutenance) -->
        <div v-if="type !== 'soutenance'" class="nd-options">
          <label class="nd-option">
            <input v-model="calculatrice" type="checkbox" />
            <Calculator :size="13" /> Calculatrice autorisée
          </label>
          <label class="nd-option">
            <input v-model="requiresSubmission" type="checkbox" />
            <FileText :size="13" /> Autoriser le dépôt de fichiers
          </label>
        </div>

        <!-- Depot optionnel pour soutenance (slides) -->
        <div v-else class="nd-options">
          <label class="nd-option">
            <input v-model="requiresSubmission" type="checkbox" />
            <FileText :size="13" /> Autoriser le dépôt des slides
          </label>
        </div>

        <div v-if="type !== 'soutenance'" class="nd-field">
          <label class="nd-label">Ressources autorisées</label>
          <select v-model="ressources" class="nd-input" aria-label="Ressources autorisées">
            <option value="Aucune">Aucune ressource</option>
            <option value="Documents personnels">Documents personnels</option>
            <option value="Tous documents">Tous documents</option>
          </select>
        </div>
      </template>

      <!-- ═══ Champs LIVRABLE / MÉMOIRE / AUTRE ═══ -->
      <template v-else>
        <div class="nd-field">
          <label class="nd-label">Description <span class="nd-hint">(optionnel)</span></label>
          <textarea v-model="description" class="nd-input nd-textarea" rows="3" placeholder="Instructions, objectifs, format attendu…" />
        </div>

        <div class="nd-row">
          <div class="nd-field nd-flex1">
            <DateTimePicker v-model="startDate" label="Ouverture" :presets="false" />
          </div>
          <div class="nd-field nd-flex1">
            <DateTimePicker v-model="deadline" label="Date limite" required />
          </div>
        </div>
        <div v-if="durationDays" class="nd-duration-bar">
          <div class="nd-duration-fill" />
          <span class="nd-duration-label">{{ durationDays }} jours</span>
        </div>
      </template>

      <!-- ── Projet + Canal (section repliable) ─────────────────────── -->
      <button type="button" class="nd-advanced-toggle" @click="showAdvanced = !showAdvanced">
        <ChevronDown :size="14" :class="{ rotated: showAdvanced }" />
        Options avancées
      </button>

      <div v-if="showAdvanced" class="nd-advanced">
        <div class="nd-row">
          <div class="nd-field nd-flex1">
            <label class="nd-label"><FolderOpen :size="12" /> Projet</label>
            <select v-if="projects.length" v-model="category" class="nd-input" aria-label="Projet">
              <option value="">Aucun projet</option>
              <option v-for="p in projects" :key="p.name" :value="p.name">
                {{ parseCategoryIcon(p.name).label || p.name }}
              </option>
            </select>
            <input v-else v-model="category" type="text" class="nd-input" placeholder="ex : Systèmes embarqués" />
          </div>
          <div class="nd-field nd-flex1">
            <label class="nd-label">Canal d'annonce</label>
            <select v-model="channelId" class="nd-input" required aria-label="Canal d'annonce">
              <option :value="null" disabled>Choisir…</option>
              <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>

        <div class="nd-field">
          <label class="nd-label">AAVs <span class="nd-hint">(un par ligne, optionnel)</span></label>
          <textarea v-model="aavs" class="nd-input nd-textarea" rows="2" placeholder="Acquis d'Apprentissage Visés…" />
        </div>

        <div class="nd-field">
          <label class="nd-label"><Clock :size="12" /> Publication programmee <span class="nd-hint">(optionnel)</span></label>
          <DateTimePicker v-model="scheduledPublishAt" label="Publier automatiquement le" :min="new Date().toISOString()" />
          <p v-if="scheduledPublishAt" class="nd-hint" style="margin-top:4px">
            Le devoir sera cree en brouillon et publie automatiquement a la date choisie.
          </p>
        </div>
      </div>

      <!-- ── Footer ─────────────────────────────────────────────────── -->
      <div class="nd-footer">
        <label class="nd-draft-toggle">
          <input v-model="isDraft" type="checkbox" />
          Brouillon
        </label>
        <Transition name="saved-fade">
          <span v-if="justSaved" class="nd-saved-indicator" role="status">
            ✓ Brouillon enregistre
          </span>
        </Transition>
        <div class="nd-footer-actions">
          <button type="button" class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
          <button
            type="submit" class="btn-primary nd-submit"
            :disabled="!canSubmit"
            :title="canSubmit ? '' : (!title.trim() ? 'Renseigne un titre' : channelId == null ? 'Selectionne un canal (Options avancees)' : '')"
            :style="{ background: canSubmit ? activeType.color : undefined }"
          >
            {{ creating ? 'Création…' : isDraft ? 'Enregistrer' : 'Publier' }}
          </button>
        </div>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.nd { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px 0; }

/* ── Sélection de type ─────────────────────────────────────────────────── */
.nd-types {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.nd-type-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 8px; border-radius: 10px; cursor: pointer;
  border: 1.5px solid var(--border); background: transparent;
  color: var(--text-muted); font-family: var(--font);
  transition: all .15s;
}
.nd-type-card:hover { border-color: var(--text-secondary); color: var(--text-primary); }
.nd-type-card.active { color: var(--text-primary); }
.nd-type-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }

.nd-type-desc {
  font-size: 12px; font-weight: 500; text-align: center;
  margin: -6px 0 2px; line-height: 1.3;
}

/* ── Champs ─────────────────────────────────────────────────────────────── */
.nd-field { display: flex; flex-direction: column; gap: 4px; }
.nd-label {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  display: flex; align-items: center; gap: 4px;
}
.nd-hint { font-weight: 400; opacity: .6; }
.nd-input {
  padding: 9px 12px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--border-input); background: var(--bg-input);
  color: var(--text-primary); font-family: var(--font);
  transition: border-color .15s;
}
.nd-input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px rgba(74,144,217,.12); }
.nd-textarea { resize: vertical; min-height: 60px; }
.nd-row { display: flex; gap: 10px; }
.nd-flex1 { flex: 1; }
.nd-duration-bar {
  position: relative; height: 6px; border-radius: 3px;
  background: var(--bg-active); margin: -4px 0 4px; overflow: hidden;
}
.nd-duration-fill {
  position: absolute; inset: 0; border-radius: 3px;
  background: linear-gradient(90deg, var(--accent), rgba(74,144,217,.3));
}
.nd-duration-label {
  position: absolute; top: -16px; right: 0;
  font-size: 10px; font-weight: 600; color: var(--accent);
  font-variant-numeric: tabular-nums;
}

/* ── Options (checkboxes) ──────────────────────────────────────────────── */
.nd-options { display: flex; gap: 16px; flex-wrap: wrap; }
.nd-option {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text-secondary); cursor: pointer;
}
.nd-option input { accent-color: var(--accent); }

/* ── Section avancée ───────────────────────────────────────────────────── */
.nd-advanced-toggle {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: none; border: none; cursor: pointer; padding: 0;
  font-family: var(--font); transition: color .15s;
}
.nd-advanced-toggle:hover { color: var(--text-primary); }
.nd-advanced-toggle svg { transition: transform .2s; }
.nd-advanced-toggle .rotated { transform: rotate(180deg); }
.nd-advanced {
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px; border-radius: 10px;
  background: var(--bg-elevated); border: 1px solid var(--border);
}

/* ── Footer ────────────────────────────────────────────────────────────── */
.nd-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0 4px; border-top: 1px solid var(--border);
  margin-top: 4px;
}
.nd-footer-actions { display: flex; gap: 8px; }
.nd-draft-toggle {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-muted); cursor: pointer;
}
.nd-draft-toggle input { accent-color: var(--accent); }
.nd-submit { min-width: 110px; transition: background .15s, opacity .15s; }
.nd-saved-indicator {
  font-size: 12px;
  color: var(--success, #2ECC71);
  margin-left: auto;
  margin-right: 8px;
  align-self: center;
}
.saved-fade-enter-active, .saved-fade-leave-active { transition: opacity .25s ease; }
.saved-fade-enter-from, .saved-fade-leave-to { opacity: 0; }

@media (max-width: 500px) {
  .nd-types { grid-template-columns: repeat(2, 1fr); }
  .nd-row { flex-direction: column; }
}
</style>
