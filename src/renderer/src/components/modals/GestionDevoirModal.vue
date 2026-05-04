<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    Eye, EyeOff, Bell, Copy, Star, Clock, MoreHorizontal, Trash2, ChevronDown,
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
      showMoreActions.value = false
      await travauxStore.openTravail(appStore.currentTravailId)
      loadRubric()
      loadRessources()
    } else if (!open) {
      showMoreActions.value = false
    }
  })

  // ── Menu "Plus d'actions" (dropdown secondaires) ─────────────────────────
  const showMoreActions = ref(false)
  function toggleMoreActions(e?: Event) { e?.stopPropagation(); showMoreActions.value = !showMoreActions.value }
  function closeMoreActions() { showMoreActions.value = false }

  // Fermer au clic exterieur. Listener pose uniquement quand le menu est ouvert
  // pour ne pas polluer le DOM global.
  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target?.closest('.gd-more-wrap')) closeMoreActions()
  }
  watch(showMoreActions, (open) => {
    if (open) setTimeout(() => document.addEventListener('click', handleOutsideClick), 0)
    else document.removeEventListener('click', handleOutsideClick)
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
  async function toggleRequiresSubmission() {
    if (!travail.value) return
    const newVal = travail.value.requires_submission === 0 ? 1 : 0
    const result = await api(() => window.api.updateTravail(travail.value!.id, { requires_submission: newVal }))
    if (result !== null) {
      showToast(newVal ? 'Depot de fichiers ouvert.' : 'Depot de fichiers ferme.', 'success')
      await travauxStore.openTravail(travail.value.id)
    }
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
              <button class="btn-cta" style="font-size:12px;margin-top:6px" @click="openRubricModal">Creer une rubrique</button>
            </div>
          </div>
        </details>
      </div>

      <!-- ═══ ACTIONS : footer sticky pour rester accessible au scroll ═══ -->
      <!-- Hierarchie : 1 CTA primaire dominant + 1 action secondaire visible +
           menu "Plus" pour les options moins frequentes (dupliquer, supprimer...).
           Evite l'ancien mur de 5+ boutons cote a cote ou "Supprimer" (danger)
           etait adjacent aux actions vertes. -->
      <div class="gd-footer" @click.self="closeMoreActions">
        <div class="gd-footer-actions">
          <!-- CTA primaire : varie selon l'etat du devoir -->
          <template v-if="travail.scheduled_publish_at">
            <button class="gd-btn gd-btn--primary" @click="publishNow">
              <Eye :size="14" /> Publier maintenant
            </button>
            <button class="gd-btn gd-btn--secondary" @click="cancelScheduledPublish">
              <Clock :size="13" /> Annuler la programmation
            </button>
          </template>
          <template v-else-if="!travail.is_published">
            <button class="gd-btn gd-btn--primary" title="Publie et envoie un message dans le canal associe" @click="publishAndNotify">
              <Eye :size="14" /> Publier et notifier
            </button>
            <button class="gd-btn gd-btn--secondary" title="Publie sans envoyer de message" @click="togglePublish">
              Publier sans notifier
            </button>
          </template>
          <template v-else>
            <button class="gd-btn gd-btn--primary" @click="showReminder = !showReminder">
              <Bell :size="14" /> Envoyer un rappel
            </button>
            <button class="gd-btn gd-btn--secondary" @click="togglePublish">
              <EyeOff :size="13" /> Dépublier
            </button>
          </template>

          <!-- Menu "Plus d'actions" : dupliquer + supprimer (danger isole) -->
          <div class="gd-more-wrap">
            <button
              class="gd-btn gd-btn--ghost"
              :class="{ 'is-open': showMoreActions }"
              :aria-expanded="showMoreActions"
              aria-haspopup="menu"
              title="Plus d'actions"
              @click="toggleMoreActions"
            >
              <MoreHorizontal :size="15" />
              <ChevronDown :size="11" class="gd-more-chevron" />
            </button>
            <div v-if="showMoreActions" class="gd-more-menu" role="menu" @click="closeMoreActions">
              <button class="gd-more-item" role="menuitem" @click="duplicateDevoir">
                <Copy :size="13" /> Dupliquer
              </button>
              <div class="gd-more-divider" />
              <button class="gd-more-item gd-more-item--danger" role="menuitem" @click="deleteDevoir">
                <Trash2 :size="13" /> Supprimer le devoir
              </button>
            </div>
          </div>
        </div>

        <!-- Keyboard hints (inline dans le footer : gain de place) -->
        <div class="gd-kbd-hints">
          <span><kbd>Esc</kbd> Fermer</span>
          <span v-if="editingTitle || editingDeadline"><kbd>Enter</kbd> Sauvegarder</span>
        </div>
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

/* ── Footer sticky avec actions + kbd hints ──────────────────────────────── */
.gd-footer {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 5;
  background: var(--bg-main);
  border-top: 1px solid var(--border);
  padding: 10px 20px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gd-footer-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

/* Boutons d'action : hierarchie claire (primaire > secondaire > ghost) */
.gd-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font);
  font-size: 13px; font-weight: 600;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast), box-shadow var(--t-fast);
}

/* CTA principal : vert, appuye, visuellement dominant */
.gd-btn--primary {
  background: var(--color-success);
  color: #fff;
  border: 1px solid var(--color-success);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
}
.gd-btn--primary:hover {
  background: color-mix(in srgb, var(--color-success) 85%, black);
  border-color: color-mix(in srgb, var(--color-success) 85%, black);
}

/* Secondaire : outline, meme poids typo mais pas de fond plein */
.gd-btn--secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
}
.gd-btn--secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

/* Ghost (menu "Plus") : discret, icone seule */
.gd-btn--ghost {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid transparent;
  padding: 6px 8px;
  margin-left: auto;
}
.gd-btn--ghost:hover, .gd-btn--ghost.is-open {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-input);
}
.gd-more-chevron { opacity: .6; }

/* Dropdown "Plus d'actions" : ouvre vers le haut pour rester dans le viewport */
.gd-more-wrap { position: relative; margin-left: auto; }
.gd-more-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px);
  min-width: 200px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .2);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: gd-more-in .12s var(--ease-out);
}
@keyframes gd-more-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.gd-more-item {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font);
  font-size: 12.5px; font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  transition: background var(--t-fast), color var(--t-fast);
}
.gd-more-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.gd-more-item--danger { color: var(--color-danger); }
.gd-more-item--danger:hover { background: rgba(231, 76, 60, .1); color: var(--color-danger); }
.gd-more-divider {
  height: 1px;
  background: var(--border);
  margin: 2px 4px;
}

/* Rubrique collapsible */
.gd-rubrique-details {
  margin: 4px 20px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
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
  transition: transform var(--motion-fast) var(--ease-out);
}
.gd-rubrique-details[open] > .gd-rubrique-summary::before { transform: rotate(90deg); }
.gd-rubrique-count {
  font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: var(--radius);
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

/* Keyboard hints (dans le footer, alignes a gauche - contexte discret) */
.gd-kbd-hints {
  display: flex; gap: 12px; justify-content: flex-start; padding: 0;
  font-size: 10px; color: var(--text-muted);
}
.gd-kbd-hints kbd {
  display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9.5px;
  background: var(--bg-hover); border: 1px solid var(--border);
  font-family: var(--font); margin-right: 2px;
  font-variant-numeric: tabular-nums;
}

/* Links */
.gd-link-btn {
  font-size: 12px; color: var(--accent); background: none; border: none;
  cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--font);
}
.gd-link-btn:hover { text-decoration: underline; }
</style>
