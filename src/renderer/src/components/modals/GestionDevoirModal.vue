<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    Eye, EyeOff, Bell, Copy, Star, Clock,
  } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useModalsStore }  from '@/stores/modals'
  import { useToast }        from '@/composables/useToast'
  import { useConfirm }      from '@/composables/useConfirm'
  import { useApi }          from '@/composables/useApi'
  import { useRouter }       from 'vue-router'
  import { formatDate }      from '@/utils/date'
  import { isEventType }     from '@/utils/devoir'
  import Modal               from '@/components/ui/Modal.vue'
  import SkeletonLoader      from '@/components/ui/SkeletonLoader.vue'
  import DevoirMetaSection   from '@/components/modals/devoir/DevoirMetaSection.vue'
  import DevoirRendusList    from '@/components/modals/devoir/DevoirRendusList.vue'
  import DevoirReminderBuilder from '@/components/modals/devoir/DevoirReminderBuilder.vue'
  import DevoirConsignesSection from '@/components/modals/devoir/DevoirConsignesSection.vue'
  import DevoirChapterLinksSection from '@/components/modals/devoir/DevoirChapterLinksSection.vue'
  import type { Rubric } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore = useTravauxStore()
  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const { showToast } = useToast()
  const { confirm: confirmDialog } = useConfirm()
  const { api }       = useApi()
  const router = useRouter()

  // ── Data loading ──────────────────────────────────────────────────────────
  watch(() => props.modelValue, async (open) => {
    if (open && appStore.currentTravailId) {
      editingTitle.value = false
      editingDeadline.value = false
      showReminder.value = false
      await travauxStore.openTravail(appStore.currentTravailId)
      loadRubric()
      loadRessources()
    }
  })

  const travail = computed(() => travauxStore.currentDevoir)
  const depots  = computed(() => travauxStore.depots)

  const depotsCounts = computed(() => {
    const all = depots.value
    const submitted = all.filter(d => d.submitted_at)
    return {
      submitted: submitted.length,
      noted: all.filter(d => d.note != null).length,
      pending: all.filter(d => !d.submitted_at).length,
      total: all.length,
    }
  })

  // ── Rubric ────────────────────────────────────────────────────────────────
  const rubric = ref<Rubric | null>(null)
  async function loadRubric() {
    if (!appStore.currentTravailId) return
    rubric.value = await api<Rubric>(
      () => window.api.getRubric(appStore.currentTravailId!) as Promise<{ ok: boolean; data?: Rubric }>,
    ) ?? null
  }

  // ── Resources ─────────────────────────────────────────────────────────────
  interface RessourceItem { id: number; name: string; type: string }
  const ressources = ref<RessourceItem[]>([])
  async function loadRessources() {
    if (!appStore.currentTravailId) return
    ressources.value = await api<RessourceItem[]>(
      () => window.api.getRessources(appStore.currentTravailId!),
    ) ?? []
  }

  // ── Field save (generic) ──────────────────────────────────────────────────
  async function saveField(field: string, value: string | number) {
    if (!travail.value) return
    const payload = { ...travail.value, [field]: value, id: travail.value.id, _update: true }
    const result = await api(() => window.api.createTravail(payload))
    if (result !== null) {
      showToast('Modifie.', 'success')
      await travauxStore.openTravail(travail.value.id)
    }
  }

  // ── Title editing ─────────────────────────────────────────────────────────
  const editingTitle = ref(false)
  const titleDraft = ref('')
  function startEditTitle() { titleDraft.value = travail.value?.title ?? ''; editingTitle.value = true }
  function saveTitle() {
    if (titleDraft.value.trim()) { saveField('title', titleDraft.value.trim()); editingTitle.value = false }
  }

  // ── Deadline editing ──────────────────────────────────────────────────────
  const editingDeadline = ref(false)
  const deadlineDraft = ref('')
  function startEditDeadline() {
    deadlineDraft.value = (travail.value?.deadline ?? '').slice(0, 16)
    editingDeadline.value = true
  }
  function saveDeadline() {
    if (deadlineDraft.value) { saveField('deadline', deadlineDraft.value + ':00'); editingDeadline.value = false }
  }

  // ── Toggle requires_submission ────────────────────────────────────────────
  function toggleRequiresSubmission() {
    if (!travail.value) return
    const newVal = travail.value.requires_submission === 0 ? 1 : 0
    saveField('requires_submission', newVal)
  }

  // ── Publish / Unpublish ───────────────────────────────────────────────────
  async function togglePublish() {
    if (!travail.value) return
    const newVal = !travail.value.is_published
    const result = await api(() => window.api.updateTravailPublished({ travailId: travail.value!.id, published: newVal }))
    if (result !== null) {
      showToast(newVal ? 'Devoir publie.' : 'Devoir mis en brouillon.', 'success')
      await travauxStore.openTravail(travail.value.id)
    }
  }

  // ── Cancel scheduled publish ───────────────────────────────────────────────
  async function cancelScheduledPublish() {
    if (!travail.value) return
    const result = await api(() => window.api.updateTravailScheduled({ travailId: travail.value!.id, scheduledAt: null }))
    if (result !== null) {
      showToast('Programmation annulee.', 'success')
      await travauxStore.openTravail(travail.value.id)
    }
  }

  // ── Publish now (override scheduled) ──────────────────────────────────────
  async function publishNow() {
    if (!travail.value) return
    await api(() => window.api.updateTravailScheduled({ travailId: travail.value!.id, scheduledAt: null }))
    await api(() => window.api.updateTravailPublished({ travailId: travail.value!.id, published: true }))
    showToast('Devoir publie immediatement.', 'success')
    await travauxStore.openTravail(travail.value.id)
  }

  // ── Publish + Notify ──────────────────────────────────────────────────────
  async function publishAndNotify() {
    if (!travail.value) return
    const warnings: string[] = []
    if (!travail.value.description?.trim()) warnings.push('La description est vide.')
    if (new Date(travail.value.deadline).getTime() < Date.now()) warnings.push('La deadline est deja passee.')
    const studentCount = depotsCounts.value.total
    const confirmLines = [
      `Publier \u00ab ${travail.value.title} \u00bb ?`,
      studentCount > 0 ? `Ce devoir sera visible par ${studentCount} etudiant${studentCount > 1 ? 's' : ''}.` : '',
      ...warnings.map(w => `\u26A0 ${w}`),
    ].filter(Boolean)
    if (!(await confirmDialog(confirmLines.join('\n'), 'warning', 'Publier'))) return
    try {
      await window.api.updateTravailPublished({ travailId: travail.value.id, published: true })
      const channelId = travail.value.channel_id
      if (channelId) {
        await window.api.sendMessage({
          channelId,
          authorName: appStore.currentUser?.name ?? 'Systeme',
          authorType: appStore.currentUser?.type ?? 'teacher',
          promoId: appStore.activePromoId ?? undefined,
          content: `@everyone Bonjour,\n\n\\[${travail.value.title}](devoir:${travail.value.id}) - ${devoirMeta.value.isEvent ? `le **${formatDate(travail.value.deadline)}**` : `a rendre avant le **${formatDate(travail.value.deadline)}**`}${devoirMeta.value.salle ? ` - Salle : **${devoirMeta.value.salle}**` : ''}`,
        })
      }
      showToast('Publie et notifie.', 'success')
      await travauxStore.openTravail(travail.value.id)
    } catch { showToast('Erreur.', 'error') }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteDevoir() {
    if (!travail.value) return
    if (!(await confirmDialog(`Supprimer "${travail.value.title}" ?\nLes soumissions et notes seront perdues.`, 'danger', 'Supprimer'))) return
    try {
      await window.api.deleteTravail(travail.value.id)
      showToast('Devoir supprime.', 'success')
      emit('update:modelValue', false)
    } catch { showToast('Erreur.', 'error') }
  }

  // ── Description save (from child component) ──────────────────────────────
  function handleSaveDescription(value: string) {
    saveField('description', value)
    showToast('Description mise a jour.', 'success')
  }

  // ── Devoir meta (for reminder) ────────────────────────────────────────────
  const devoirMeta = computed(() => {
    const desc = travail.value?.description ?? ''
    return {
      salle:        desc.match(/Salle\s*:\s*(.+)/i)?.[1]?.trim() ?? travail.value?.room ?? null,
      duree:        desc.match(/Dur\u00e9e\s*:\s*(\d+)\s*min/i)?.[1] ?? null,
      session:      desc.match(/\*\*Session\s+(\w+)\*\*/)?.[1] ?? null,
      calculatrice: /Calculatrice autoris\u00e9e/i.test(desc),
      ressources:   desc.match(/Ressources?\s*:\s*(.+)/i)?.[1]?.trim() ?? (/Aucune ressource/i.test(desc) ? 'Aucune' : null),
      aavs:         travail.value?.aavs ?? null,
      isEvent:      isEventType(travail.value?.type ?? ''),
    }
  })

  // ── Reminder ──────────────────────────────────────────────────────────────
  const showReminder = ref(false)

  async function handleSendReminder(message: string) {
    if (!travail.value) return
    const channelId = travail.value.channel_id
    if (!channelId) { showToast('Aucun canal associe.', 'error'); return }
    try {
      await window.api.sendMessage({
        channelId,
        authorName: appStore.currentUser?.name ?? 'Systeme',
        authorType: appStore.currentUser?.type ?? 'teacher',
        content: message,
      })
      showToast('Rappel envoye dans le canal.', 'success')
      showReminder.value = false
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
      channelId: travail.value.channel_id,
    }
    emit('update:modelValue', false)
    modals.newDevoir = true
  }

  function goToChannel() {
    if (!travail.value) return
    const chId = travail.value.channel_id
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
    :title="travail?.title ?? 'Detail du devoir'"
    max-width="760px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Loading skeleton -->
    <div v-if="!travail" class="gd-loading">
      <SkeletonLoader variant="line" />
      <SkeletonLoader variant="line" />
      <SkeletonLoader variant="line" />
    </div>

    <template v-else>
      <div class="gd-scroll">
        <!-- ═══ 1. META (above the fold) ═══ -->
        <DevoirMetaSection
          :travail="travail"
          :depots-counts="depotsCounts"
          :editing-title="editingTitle"
          :title-draft="titleDraft"
          :editing-deadline="editingDeadline"
          :deadline-draft="deadlineDraft"
          @start-edit-title="startEditTitle"
          @save-title="saveTitle"
          @update:title-draft="titleDraft = $event"
          @update:editing-title="editingTitle = $event"
          @start-edit-deadline="startEditDeadline"
          @save-deadline="saveDeadline"
          @update:deadline-draft="deadlineDraft = $event"
          @update:editing-deadline="editingDeadline = $event"
          @toggle-requires-submission="toggleRequiresSubmission"
          @go-to-channel="goToChannel"
        />

        <!-- Separator -->
        <hr class="gd-separator" />

        <!-- ═══ 2. RENDUS (unified list) ═══ -->
        <DevoirRendusList
          :depots="depots"
          @open-depots="openDepots"
        />

        <!-- Separator -->
        <hr class="gd-separator" />

        <!-- ═══ 3. CHAPITRES LUMEN LIES ═══ -->
        <DevoirChapterLinksSection
          :travail-id="travail.id"
          :promo-id="appStore.activePromoId"
        />

        <!-- Separator -->
        <hr class="gd-separator" />

        <!-- ═══ 4. CONSIGNES + AAVs + RESSOURCES ═══ -->
        <DevoirConsignesSection
          :travail="travail"
          :ressources="ressources"
          @save-description="handleSaveDescription"
          @open-ressources-modal="openRessourcesModal"
        />

        <!-- Separator -->
        <hr class="gd-separator" />

        <!-- ═══ 4. ACTIONS ═══ -->
        <div class="gd-actions-bar">
          <template v-if="travail.scheduled_publish_at">
            <button class="gd-action-btn gd-action-btn--primary" @click="publishNow">
              <Eye :size="13" /> Publier maintenant
            </button>
            <button class="gd-action-btn" @click="cancelScheduledPublish">
              <Clock :size="13" /> Annuler la programmation
            </button>
          </template>
          <template v-else-if="!travail.is_published">
            <button class="gd-action-btn gd-action-btn--primary" @click="publishAndNotify">
              <Eye :size="13" /> Publier et notifier
            </button>
            <button class="gd-action-btn" @click="togglePublish">
              <Eye :size="13" /> Publier sans notifier
            </button>
          </template>
          <template v-else>
            <button class="gd-action-btn" @click="showReminder = !showReminder">
              <Bell :size="13" /> Envoyer un rappel
            </button>
            <button class="gd-action-btn" @click="togglePublish">
              <EyeOff :size="13" /> Depublier
            </button>
          </template>
          <button class="gd-action-btn" @click="duplicateDevoir">
            <Copy :size="13" /> Dupliquer
          </button>
          <button class="gd-action-btn gd-action-btn--danger" @click="deleteDevoir">
            Supprimer
          </button>
        </div>

        <!-- Reminder builder (inline, toggled) -->
        <DevoirReminderBuilder
          v-if="showReminder"
          :travail="travail"
          :meta="devoirMeta"
          @send="handleSendReminder"
          @close="showReminder = false"
        />

        <!-- Separator -->
        <hr class="gd-separator" />

        <!-- ═══ 5. RUBRIQUE (collapsible) ═══ -->
        <details class="gd-rubrique-details">
          <summary class="gd-rubrique-summary">
            <Star :size="13" />
            Rubrique de notation
            <span v-if="rubric?.criteria?.length" class="gd-rubrique-count">{{ rubric.criteria.length }} critere{{ rubric.criteria.length > 1 ? 's' : '' }}</span>
          </summary>
          <div class="gd-rubrique-content">
            <template v-if="rubric && rubric.criteria?.length">
              <table class="gd-rubric-table">
                <thead><tr><th>Critere</th><th>Points max</th><th>Poids</th></tr></thead>
                <tbody>
                  <tr v-for="c in rubric.criteria" :key="c.id">
                    <td>{{ c.label }}</td>
                    <td class="gd-rubric-num">{{ c.max_pts }}</td>
                    <td class="gd-rubric-num">&times;{{ c.weight }}</td>
                  </tr>
                </tbody>
              </table>
              <button class="gd-link-btn" style="margin-top:10px" @click="openRubricModal">
                <Star :size="12" /> Modifier la rubrique
              </button>
            </template>
            <div v-else class="gd-rubric-empty">
              <p>Aucune rubrique definie.</p>
              <button class="btn-primary" style="font-size:12px;margin-top:6px" @click="openRubricModal">Creer une rubrique</button>
            </div>
          </div>
        </details>
      </div>

      <!-- Keyboard hints -->
      <div class="gd-kbd-hints">
        <span><kbd>Esc</kbd> Fermer</span>
        <span v-if="editingTitle || editingDeadline"><kbd>Enter</kbd> Sauvegarder</span>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.gd-loading { padding: 24px 20px; }

/* Scrollable container */
.gd-scroll {
  max-height: 65vh; overflow-y: auto; overflow-x: hidden;
  scroll-behavior: smooth;
}

/* Separators */
.gd-separator {
  border: none; border-top: 1px solid var(--border);
  margin: 4px 20px;
}

/* Actions */
.gd-actions-bar {
  display: flex; gap: 6px; flex-wrap: wrap; padding: 8px 20px;
}
.gd-action-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 6px;
  background: var(--bg-hover); color: var(--text-secondary);
  border: 1px solid var(--border-input); cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast);
}
.gd-action-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
.gd-action-btn--primary { background: rgba(46,204,113,.1); color: var(--color-success); border-color: rgba(46,204,113,.25); }
.gd-action-btn--primary:hover { background: rgba(46,204,113,.2); }
.gd-action-btn--danger { color: var(--color-danger); }
.gd-action-btn--danger:hover { background: rgba(231,76,60,.1); }

/* Rubrique collapsible */
.gd-rubrique-details {
  margin: 4px 20px 12px; border: 1px solid var(--border); border-radius: 8px;
  overflow: hidden;
}
.gd-rubrique-summary {
  display: flex; align-items: center; gap: 6px; padding: 10px 14px;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  cursor: pointer; user-select: none; list-style: none;
  background: var(--bg-elevated); transition: background var(--t-fast);
}
.gd-rubrique-summary:hover { background: var(--bg-hover); }
.gd-rubrique-summary::-webkit-details-marker { display: none; }
.gd-rubrique-summary::before {
  content: '\25B6'; font-size: 9px; color: var(--text-muted);
  transition: transform .15s ease;
}
.gd-rubrique-details[open] > .gd-rubrique-summary::before { transform: rotate(90deg); }
.gd-rubrique-count {
  font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 10px;
  background: var(--bg-hover); color: var(--text-muted); margin-left: auto;
}
.gd-rubrique-content { padding: 12px 14px; }

/* Rubric table */
.gd-rubric-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.gd-rubric-table th {
  text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .3px; padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
.gd-rubric-table td { padding: 6px 8px; color: var(--text-secondary); border-bottom: 1px solid var(--border); }
.gd-rubric-num { text-align: center; font-weight: 600; color: var(--text-primary); }
.gd-rubric-empty {
  text-align: center; color: var(--text-muted); font-size: 13px; padding: 12px 0;
}

/* Keyboard hints */
.gd-kbd-hints {
  display: flex; gap: 14px; justify-content: center; padding: 6px 20px;
  font-size: 10px; color: var(--text-muted); border-top: 1px solid var(--border);
}
.gd-kbd-hints kbd {
  display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 9px;
  background: var(--bg-hover); border: 1px solid var(--border);
  font-family: var(--font); margin-right: 2px;
}

/* Links */
.gd-link-btn {
  font-size: 12px; color: var(--accent); background: none; border: none;
  cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--font);
}
.gd-link-btn:hover { text-decoration: underline; }
</style>
