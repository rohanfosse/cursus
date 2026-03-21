<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    Users, Clock, CheckCircle2, XCircle, Copy, Eye, EyeOff,
    FileText, Star, Bell, ExternalLink, ChevronRight, Award,
  } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useModalsStore }  from '@/stores/modals'
  import { useToast }        from '@/composables/useToast'
  import { useRouter }       from 'vue-router'
  import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
  import { avatarColor, initials, formatGrade, gradeClass } from '@/utils/format'
  import Modal from '@/components/ui/Modal.vue'
  import type { Rubric } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore = useTravauxStore()
  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const { showToast } = useToast()
  const router = useRouter()

  // ── Onglets ────────────────────────────────────────────────────────────────
  type Tab = 'apercu' | 'rendus' | 'rubrique'
  const activeTab = ref<Tab>('apercu')

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.currentTravailId) {
      activeTab.value = 'apercu'
      editingDesc.value = false
      await travauxStore.openTravail(appStore.currentTravailId)
      loadRubric()
      loadRessources()
    }
  })

  const travail = computed(() => travauxStore.currentDevoir)
  const depots  = computed(() => travauxStore.depots)

  const submittedDepots = computed(() => depots.value.filter(d => d.submitted_at))
  const notedDepots     = computed(() => depots.value.filter(d => d.note != null))
  const pendingDepots   = computed(() => depots.value.filter(d => !d.submitted_at))
  const totalCount      = computed(() => depots.value.length)
  const submitPct       = computed(() =>
    totalCount.value ? Math.round((submittedDepots.value.length / totalCount.value) * 100) : 0,
  )

  // ── Indicateur de statut ──────────────────────────────────────────────────
  const devoirStatus = computed(() => {
    if (!travail.value) return null
    if (!travail.value.is_published) return { label: 'Brouillon', cls: 'status-draft' }
    if (totalCount.value > 0 && submittedDepots.value.length >= totalCount.value) return { label: 'Complet', cls: 'status-complete' }
    if (new Date(travail.value.deadline).getTime() < Date.now()) return { label: 'Expiré', cls: 'status-expired' }
    return { label: 'Publié', cls: 'status-published' }
  })

  // ── Distribution notes ────────────────────────────────────────────────────
  const GRADE_ORDER = ['A', 'B', 'C', 'D', 'NA']
  const gradeDistribution = computed(() => {
    const counts: Record<string, number> = {}
    for (const d of depots.value) { if (d.note) counts[d.note] = (counts[d.note] ?? 0) + 1 }
    return GRADE_ORDER.filter(g => counts[g]).map(g => ({ grade: g, count: counts[g] }))
  })

  // ── Rubrique ──────────────────────────────────────────────────────────────
  const rubric = ref<Rubric | null>(null)
  async function loadRubric() {
    if (!appStore.currentTravailId) return
    try {
      const res = await window.api.getRubric(appStore.currentTravailId)
      rubric.value = res?.ok ? res.data : null
    } catch { rubric.value = null }
  }

  // ── Ressources ────────────────────────────────────────────────────────────
  const ressources = ref<{ id: number; name: string; type: string }[]>([])
  async function loadRessources() {
    if (!appStore.currentTravailId) return
    try {
      const res = await window.api.getRessources(appStore.currentTravailId)
      ressources.value = res?.ok ? (res.data as unknown as typeof ressources.value) : []
    } catch { ressources.value = [] }
  }

  // ── Extension deadline ────────────────────────────────────────────────────
  async function extendDeadline(days: number) {
    if (!travail.value) return
    const current = new Date(travail.value.deadline)
    current.setDate(current.getDate() + days)
    try {
      const res = await window.api.createTravail({ ...travail.value, deadline: current.toISOString(), id: travail.value.id, _update: true } as any)
      if (res?.ok) {
        showToast(`Deadline prolongée de ${days}j.`, 'success')
        await travauxStore.openTravail(travail.value.id)
      }
    } catch { showToast('Erreur.', 'error') }
  }

  // ── Publier / Dépublier ───────────────────────────────────────────────────
  async function togglePublish() {
    if (!travail.value) return
    const newVal = !travail.value.is_published
    try {
      await window.api.updateTravailPublished({ travailId: travail.value.id, published: newVal })
      showToast(newVal ? 'Devoir publié.' : 'Devoir mis en brouillon.', 'success')
      await travauxStore.openTravail(travail.value.id)
    } catch { showToast('Erreur.', 'error') }
  }

  // ── Description inline ────────────────────────────────────────────────────
  const editingDesc = ref(false)
  const descDraft = ref('')
  function startEditDesc() {
    descDraft.value = travail.value?.description ?? ''
    editingDesc.value = true
  }

  // ── Parser description structurée ────────────────────────────────────────
  const parsedDesc = computed(() => {
    const desc = travail.value?.description ?? ''
    if (!desc) return null
    const fields: { label: string; value: string; icon?: string }[] = []
    const sessionMatch = desc.match(/\*\*Session\s+(\w+)\*\*/)
    if (sessionMatch) fields.push({ label: 'Session', value: sessionMatch[1], icon: sessionMatch[1] === 'Rattrapage' ? '🔄' : '📝' })
    const dureeMatch = desc.match(/Durée\s*:\s*(\d+)\s*min/i)
    if (dureeMatch) fields.push({ label: 'Durée', value: dureeMatch[1] + ' min', icon: '⏱' })
    const formatMatch = desc.match(/Format\s*:\s*(.+)/i)
    if (formatMatch) fields.push({ label: 'Format', value: formatMatch[1].trim(), icon: '📋' })
    if (/Calculatrice autorisée/i.test(desc)) fields.push({ label: 'Calculatrice', value: 'Autorisée', icon: '🧮' })
    else if (/Calculatrice non/i.test(desc)) fields.push({ label: 'Calculatrice', value: 'Non autorisée', icon: '🚫' })
    const resMatch = desc.match(/(?:Aucune ressource|Ressources?\s*:\s*(.+))/i)
    if (resMatch) fields.push({ label: 'Ressources', value: resMatch[1] || 'Aucune', icon: '📚' })
    const salleMatch = desc.match(/Salle\s*:\s*(.+)/i)
    if (salleMatch) fields.push({ label: 'Salle', value: salleMatch[1].trim(), icon: '🏫' })
    const horaireMatch = desc.match(/Horaire\s*:\s*(.+)/i)
    if (horaireMatch) fields.push({ label: 'Horaire', value: horaireMatch[1].trim(), icon: '🕐' })
    return fields.length > 0 ? fields : null
  })

  // ── Notifier les étudiants ────────────────────────────────────────────────
  async function notifyStudents() {
    if (!travail.value) return
    const channelId = (travail.value as any).channel_id
    if (!channelId) { showToast('Aucun canal associé.', 'error'); return }
    const msg = `📢 **Rappel** : le devoir **${travail.value.title}** est à rendre avant le **${formatDate(travail.value.deadline)}**.`
    try {
      await window.api.sendMessage({
        channelId,
        authorName: appStore.currentUser?.name ?? 'Système',
        authorType: appStore.currentUser?.type ?? 'teacher',
        content: msg,
      })
      showToast('Rappel envoyé dans le canal.', 'success')
    } catch { showToast('Erreur lors de l\'envoi.', 'error') }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function openDepots() { emit('update:modelValue', false); modals.depots = true }
  function openRubricModal() { emit('update:modelValue', false); modals.rubric = true }
  function openRessourcesModal() { emit('update:modelValue', false); modals.ressources = true }

  function duplicateDevoir() {
    if (!travail.value) return
    appStore.duplicateDevoirData = {
      title: travail.value.title + ' (copie)',
      type: travail.value.type,
      category: travail.value.category,
      description: travail.value.description,
      channelId: (travail.value as any).channel_id,
    }
    emit('update:modelValue', false)
    modals.newDevoir = true
  }

  function goToChannel() {
    if (!travail.value) return
    const chId = (travail.value as any).channel_id
    const chName = travail.value.channel_name
    if (chId && chName) {
      appStore.openChannel(chId, appStore.activePromoId ?? 0, chName)
      router.push('/messages')
      emit('update:modelValue', false)
    }
  }
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="travail?.title ?? 'Détail du devoir'"
    max-width="720px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="!travail" class="gd-loading">
      <div class="skel skel-line skel-w50" style="height:16px;margin-bottom:10px" />
      <div class="skel skel-line skel-w90" style="height:12px;margin-bottom:8px" />
      <div class="skel skel-line skel-w70" style="height:12px" />
    </div>

    <template v-else>
      <!-- ── Indicateur de statut ──────────────────────────────────────────── -->
      <div v-if="devoirStatus" class="gd-status" :class="devoirStatus.cls">
        {{ devoirStatus.label }}
      </div>

      <!-- ── Onglets ──────────────────────────────────────────────────────── -->
      <div class="gd-tabs">
        <button class="gd-tab" :class="{ active: activeTab === 'apercu' }" @click="activeTab = 'apercu'">Aperçu</button>
        <button class="gd-tab" :class="{ active: activeTab === 'rendus' }" @click="activeTab = 'rendus'">
          Rendus <span v-if="totalCount" class="gd-tab-badge">{{ submittedDepots.length }}/{{ totalCount }}</span>
        </button>
        <button class="gd-tab" :class="{ active: activeTab === 'rubrique' }" @click="activeTab = 'rubrique'">Rubrique</button>
      </div>

      <!-- ════════ ONGLET APERÇU ════════ -->
      <div v-if="activeTab === 'apercu'" class="gd-panel">

        <!-- Carte Informations -->
        <div class="gd-card">
          <div class="gd-card-row">
            <span class="travail-type-badge" :class="`type-${travail.type}`">{{ travail.type }}</span>
            <span v-if="travail.category" class="tag-badge">{{ travail.category }}</span>
            <span class="deadline-badge" :class="deadlineClass(travail.deadline)">
              <Clock :size="10" /> {{ deadlineLabel(travail.deadline) }}
            </span>
          </div>
          <div class="gd-card-grid">
            <div class="gd-card-field">
              <span class="gd-field-label">Échéance</span>
              <span class="gd-field-value">
                {{ formatDate(travail.deadline) }}
                <span class="gd-extend-btns">
                  <button class="gd-extend-btn" @click="extendDeadline(1)">+1j</button>
                  <button class="gd-extend-btn" @click="extendDeadline(3)">+3j</button>
                  <button class="gd-extend-btn" @click="extendDeadline(7)">+1sem</button>
                </span>
              </span>
            </div>
            <div v-if="travail.start_date" class="gd-card-field">
              <span class="gd-field-label">Début</span>
              <span class="gd-field-value">{{ formatDate(travail.start_date) }}</span>
            </div>
            <div v-if="travail.channel_name" class="gd-card-field">
              <span class="gd-field-label">Canal</span>
              <button class="gd-link-btn" @click="goToChannel"># {{ travail.channel_name }} <ExternalLink :size="10" /></button>
            </div>
            <div class="gd-card-field">
              <span class="gd-field-label">Assigné à</span>
              <span class="gd-field-value">{{ travail.assigned_to === 'group' ? `Groupe ${travail.group_name ?? ''}` : 'Toute la promo' }}</span>
            </div>
          </div>
        </div>

        <!-- Carte Consignes / Description -->
        <div class="gd-card">
          <span class="gd-card-label">Consignes</span>

          <!-- Vue structurée si la description est parsable -->
          <template v-if="parsedDesc && !editingDesc">
            <div class="gd-parsed-fields">
              <div v-for="f in parsedDesc" :key="f.label" class="gd-parsed-field">
                <span class="gd-parsed-icon">{{ f.icon }}</span>
                <span class="gd-parsed-label">{{ f.label }}</span>
                <span class="gd-parsed-value">{{ f.value }}</span>
              </div>
            </div>
            <button class="gd-link-btn" style="margin-top:6px" @click="startEditDesc">Modifier la description</button>
          </template>

          <!-- Vue texte brut (non structuré ou édition) -->
          <template v-else-if="!editingDesc">
            <div class="gd-description" @click="startEditDesc" title="Cliquer pour modifier">
              <pre class="gd-desc-pre">{{ travail.description || 'Aucune description — cliquez pour en ajouter.' }}</pre>
            </div>
          </template>

          <div v-else class="gd-desc-edit">
            <textarea v-model="descDraft" class="gd-desc-textarea" rows="4" />
            <div class="gd-desc-edit-actions">
              <button class="btn-ghost" style="font-size:11px" @click="editingDesc = false">Annuler</button>
              <button class="btn-primary" style="font-size:11px;padding:3px 10px" @click="editingDesc = false; showToast('Description mise à jour.', 'success')">OK</button>
            </div>
          </div>
        </div>

        <!-- AAVs -->
        <div v-if="travail.aavs" class="gd-section">
          <span class="gd-section-title"><Award :size="12" /> Objectifs d'apprentissage</span>
          <p class="gd-aavs">{{ travail.aavs }}</p>
        </div>

        <!-- Ressources -->
        <div v-if="ressources.length || true" class="gd-section">
          <span class="gd-section-title"><FileText :size="12" /> Ressources ({{ ressources.length }})</span>
          <div v-for="r in ressources" :key="r.id" class="gd-resource-item">
            <FileText :size="12" style="opacity:.5" />
            <span>{{ r.name }}</span>
          </div>
          <button class="gd-link-btn" style="margin-top:4px" @click="openRessourcesModal">+ Gérer les ressources</button>
        </div>

        <!-- Actions rapides -->
        <div class="gd-actions-bar">
          <button class="gd-action-btn" @click="togglePublish">
            <Eye v-if="!travail.is_published" :size="13" /> <EyeOff v-else :size="13" />
            {{ travail.is_published ? 'Mettre en brouillon' : 'Publier' }}
          </button>
          <button class="gd-action-btn" @click="notifyStudents">
            <Bell :size="13" /> Rappeler
          </button>
          <button class="gd-action-btn" @click="duplicateDevoir">
            <Copy :size="13" /> Dupliquer
          </button>
        </div>
      </div>

      <!-- ════════ ONGLET RENDUS ════════ -->
      <div v-else-if="activeTab === 'rendus'" class="gd-panel">
        <!-- Progression -->
        <div class="gd-progress-block">
          <div class="gd-progress-header">
            <span class="gd-progress-counts">
              <strong>{{ submittedDepots.length }}</strong> déposé{{ submittedDepots.length > 1 ? 's' : '' }}
              · <strong>{{ notedDepots.length }}</strong> noté{{ notedDepots.length > 1 ? 's' : '' }}
              / {{ totalCount }}
            </span>
            <span class="gd-progress-pct">{{ submitPct }}%</span>
          </div>
          <div class="linear-progress"><div class="linear-progress-fill" :style="{ width: submitPct + '%' }" /></div>
        </div>

        <!-- Distribution notes -->
        <div v-if="gradeDistribution.length" class="gd-grade-dist">
          <span
            v-for="g in gradeDistribution" :key="g.grade"
            class="grade-dist-pill" :class="gradeClass(g.grade)"
          >{{ g.grade }} <strong>{{ g.count }}</strong></span>
        </div>

        <!-- Colonnes -->
        <div class="gd-columns">
          <div class="gd-column">
            <div class="gd-column-header"><CheckCircle2 :size="14" style="color:var(--color-success)" /> Rendus ({{ submittedDepots.length }})</div>
            <div class="gd-column-body">
              <div v-for="d in submittedDepots" :key="d.id" class="gd-student-row gd-student-row--rich">
                <div class="avatar" :style="{ background: avatarColor(d.student_name), width:'24px', height:'24px', fontSize:'9px', borderRadius:'5px' }">{{ initials(d.student_name) }}</div>
                <div class="gd-student-info">
                  <span class="gd-student-name">{{ d.student_name }}</span>
                  <span v-if="d.feedback" class="gd-student-feedback">{{ d.feedback }}</span>
                </div>
                <span v-if="d.note" class="gd-grade" :class="gradeClass(d.note)">{{ formatGrade(d.note) }}</span>
                <span v-else class="gd-no-grade">—</span>
              </div>
              <div v-if="!submittedDepots.length" class="gd-empty">Aucun rendu.</div>
            </div>
          </div>
          <div class="gd-column">
            <div class="gd-column-header"><XCircle :size="14" style="color:var(--color-danger)" /> En attente ({{ pendingDepots.length }})</div>
            <div class="gd-column-body">
              <div v-for="d in pendingDepots" :key="d.id" class="gd-student-row pending">
                <div class="avatar" :style="{ background: avatarColor(d.student_name), width:'24px', height:'24px', fontSize:'9px', borderRadius:'5px', opacity:'.5' }">{{ initials(d.student_name) }}</div>
                <span class="gd-student-name" style="opacity:.6">{{ d.student_name }}</span>
              </div>
              <div v-if="!pendingDepots.length" class="gd-empty" style="color:var(--color-success)">Tout le monde a rendu !</div>
            </div>
          </div>
        </div>

        <div class="gd-rendus-footer">
          <button class="btn-primary" style="font-size:13px" @click="openDepots"><Users :size="14" /> Voir tous les dépôts</button>
        </div>
      </div>

      <!-- ════════ ONGLET RUBRIQUE ════════ -->
      <div v-else class="gd-panel">
        <div v-if="rubric && rubric.criteria?.length" class="gd-rubric-view">
          <h4 class="gd-rubric-title">{{ rubric.title }}</h4>
          <table class="gd-rubric-table">
            <thead><tr><th>Critère</th><th>Points max</th><th>Poids</th></tr></thead>
            <tbody>
              <tr v-for="c in rubric.criteria" :key="c.id">
                <td>{{ c.label }}</td>
                <td class="gd-rubric-num">{{ c.max_pts }}</td>
                <td class="gd-rubric-num">×{{ c.weight }}</td>
              </tr>
            </tbody>
          </table>
          <button class="gd-link-btn" style="margin-top:10px" @click="openRubricModal"><Star :size="12" /> Modifier la rubrique</button>
        </div>
        <div v-else class="gd-rubric-empty">
          <Star :size="32" style="opacity:.2;margin-bottom:8px" />
          <p>Aucune rubrique définie pour ce devoir.</p>
          <button class="btn-primary" style="font-size:13px;margin-top:8px" @click="openRubricModal">Créer une rubrique</button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.gd-loading { padding: 24px 20px; }

/* Statut */
.gd-status {
  text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; padding: 4px 0;
}
.status-draft     { background: rgba(255,255,255,.05); color: var(--text-muted); border-bottom: 1px dashed var(--border); }
.status-published { background: rgba(34,197,94,.08); color: #22c55e; }
.status-expired   { background: rgba(239,68,68,.08); color: #f87171; }
.status-complete  { background: rgba(59,130,246,.08); color: #60a5fa; }

/* Onglets */
.gd-tabs {
  display: flex; border-bottom: 1px solid var(--border); padding: 0 20px;
}
.gd-tab {
  padding: 8px 14px; font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: none; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all var(--t-fast);
}
.gd-tab:hover { color: var(--text-secondary); }
.gd-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.gd-tab-badge {
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 8px;
  background: rgba(255,255,255,.08); margin-left: 4px;
}

/* Panel commun */
.gd-panel { padding: 14px 20px; min-height: 200px; max-height: 50vh; overflow-y: auto; }

/* Meta */
/* Cartes dans l'aperçu */
.gd-card {
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
  border-radius: 8px; padding: 12px; margin-bottom: 10px;
}
.gd-card-label {
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .4px; margin-bottom: 8px; display: block;
}
.gd-card-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.gd-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.gd-card-field { }
.gd-field-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .3px; display: block; margin-bottom: 2px; }
.gd-field-value { font-size: 13px; color: var(--text-primary); }
.gd-desc-pre { font-family: var(--font); font-size: 13px; white-space: pre-wrap; line-height: 1.5; margin: 0; color: var(--text-secondary); }

/* Champs parsés structurés */
.gd-parsed-fields {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.gd-parsed-field {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 6px;
  background: rgba(255,255,255,.03); font-size: 13px;
}
.gd-parsed-icon { font-size: 14px; flex-shrink: 0; }
.gd-parsed-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .3px; min-width: 55px; }
.gd-parsed-value { color: var(--text-primary); font-weight: 500; }

@media (max-width: 450px) { .gd-parsed-fields { grid-template-columns: 1fr; } }

@media (max-width: 500px) { .gd-card-grid { grid-template-columns: 1fr; } }
.gd-extend-btns { display: inline-flex; gap: 3px; margin-left: 4px; }
.gd-extend-btn {
  font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 4px;
  background: rgba(255,255,255,.06); color: var(--accent); border: 1px solid var(--border-input);
  cursor: pointer; font-family: var(--font);
}
.gd-extend-btn:hover { background: rgba(255,255,255,.12); }
.gd-link-btn {
  font-size: 12px; color: var(--accent); background: none; border: none;
  cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--font);
}
.gd-link-btn:hover { text-decoration: underline; }

.gd-description {
  font-size: 13px; color: var(--text-secondary); line-height: 1.5;
  padding: 8px 12px; background: rgba(255,255,255,.03); border-radius: 6px;
  border-left: 3px solid var(--border-input); margin-bottom: 10px;
  cursor: pointer; transition: background var(--t-fast);
}
.gd-description:hover { background: rgba(255,255,255,.06); }
.gd-desc-edit { margin-bottom: 10px; }
.gd-desc-textarea {
  width: 100%; background: var(--bg-input); border: 1px solid var(--border-input);
  border-radius: 6px; padding: 8px; color: var(--text-primary); font-size: 13px;
  font-family: var(--font); resize: vertical;
}
.gd-desc-edit-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }

/* Sections */
.gd-section { margin-bottom: 12px; }
.gd-section-title {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px;
}
.gd-aavs {
  font-size: 13px; color: var(--text-secondary); line-height: 1.5;
  padding: 6px 10px; background: rgba(255,255,255,.03); border-radius: 6px;
  white-space: pre-wrap;
}
.gd-resource-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-secondary); padding: 3px 0;
}

/* Actions rapides */
.gd-actions-bar {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;
  padding-top: 10px; border-top: 1px solid var(--border);
}
.gd-action-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 6px;
  background: rgba(255,255,255,.05); color: var(--text-secondary);
  border: 1px solid var(--border-input); cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast);
}
.gd-action-btn:hover { background: rgba(255,255,255,.1); color: var(--text-primary); }

/* Progression (onglet Rendus) */
.gd-progress-block { margin-bottom: 10px; }
.gd-progress-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.gd-progress-counts { font-size: 12px; color: var(--text-secondary); }
.gd-progress-counts strong { color: var(--text-primary); }
.gd-progress-pct { font-size: 12px; font-weight: 700; color: var(--accent); }

.gd-grade-dist { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
.grade-dist-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;
}
.grade-dist-pill.grade-a  { background: rgba(39,174,96,.12); color: var(--color-success); }
.grade-dist-pill.grade-b  { background: rgba(39,174,96,.07); color: #27ae60; }
.grade-dist-pill.grade-c  { background: rgba(243,156,18,.12); color: var(--color-warning); }
.grade-dist-pill.grade-d  { background: rgba(231,76,60,.12); color: var(--color-danger); }
.grade-dist-pill.grade-na { background: rgba(255,255,255,.05); color: var(--text-muted); }
.grade-dist-pill strong { font-weight: 800; }

/* Colonnes rendus/en attente */
.gd-columns { display: grid; grid-template-columns: 1fr 1fr; min-height: 100px; max-height: 32vh; overflow: hidden; }
.gd-column { display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.gd-column:first-child { padding-right: 10px; border-right: 1px solid var(--border); }
.gd-column:last-child  { padding-left: 10px; }
.gd-column-header { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 4px; }
.gd-column-body { display: flex; flex-direction: column; gap: 3px; overflow-y: auto; flex: 1; }
.gd-student-row { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 5px; }
.gd-student-row:hover { background: rgba(255,255,255,.04); }
.gd-student-row--rich { align-items: flex-start; }
.gd-student-info { flex: 1; min-width: 0; }
.gd-student-name { font-size: 12px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.gd-student-feedback { font-size: 10px; color: var(--text-muted); font-style: italic; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.gd-grade { font-size: 12px; font-weight: 800; width: 20px; text-align: center; }
.gd-grade.grade-a { color: var(--color-success); }
.gd-grade.grade-b { color: #27ae60; }
.gd-grade.grade-c { color: var(--color-warning); }
.gd-grade.grade-d { color: var(--color-danger); }
.gd-no-grade { font-size: 12px; color: var(--text-muted); width: 20px; text-align: center; }
.gd-empty { font-size: 12px; color: var(--text-muted); font-style: italic; padding: 6px 0; }

.gd-rendus-footer { display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }

/* Rubrique */
.gd-rubric-view { }
.gd-rubric-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
.gd-rubric-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.gd-rubric-table th {
  text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .3px; padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
.gd-rubric-table td { padding: 6px 8px; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,.03); }
.gd-rubric-num { text-align: center; font-weight: 600; color: var(--text-primary); }

.gd-rubric-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 13px;
}

/* Badges existants */
.travail-type-badge {
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .4px; padding: 3px 9px; border-radius: 20px;
}
.type-livrable      { background: rgba(74,144,217,.2);    color: var(--accent); }
.type-soutenance    { background: rgba(232,137,26,.2);    color: var(--color-warning); }
.type-cctl          { background: rgba(142,68,173,.2);    color: #a569bd; }
.type-etude_de_cas  { background: rgba(39,174,96,.2);     color: var(--color-success); }
.type-memoire       { background: rgba(231,76,60,.2);     color: #e74c3c; }
.type-autre         { background: rgba(127,140,141,.2);   color: #95a5a6; }
.tag-badge          { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,.06); color: var(--text-secondary); }
</style>
