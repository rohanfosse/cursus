<script setup lang="ts">
/**
 * Modal "Transferer un message" : l'utilisateur choisit un canal de destination
 * puis optionnellement ajoute un commentaire. Le message transfere reprend le
 * contenu d'origine avec un entete d'attribution et un lien cursus:// pour
 * permettre de remonter au message original (permalien natif).
 *
 * Inspire du comportement Slack "Share message" / Discord "Forward".
 * Actuellement limite aux canaux de la promo active (pas aux DM) pour garder
 * la v1 simple — extension DM possible via un second onglet si besoin.
 *
 * A11y :
 * - role="dialog" via Modal.vue
 * - focus sur le champ recherche a l'ouverture
 * - ESC pour fermer
 * - Enter dans la recherche ne submit pas (garde le comportement de filtrage)
 */
import { ref, computed, watch, nextTick } from 'vue'
import { Search, Hash, Lock, Megaphone, Forward, X } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useApi } from '@/composables/useApi'
import type { Channel, Message } from '@/types'

interface Props {
  modelValue: boolean
  message: Message | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'forwarded': [channelId: number]
}>()

const appStore = useAppStore()
const { showToast } = useToast()
const { api } = useApi()

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const additionalComment = ref('')
const channels = ref<Channel[]>([])
const loading = ref(false)
const sendingTo = ref<number | null>(null)

// ── Chargement des canaux (a l'ouverture) ──────────────────────────────────
watch(() => props.modelValue, async (open) => {
  if (!open) return
  searchQuery.value = ''
  additionalComment.value = ''
  sendingTo.value = null
  await loadChannels()
  await nextTick()
  searchInputRef.value?.focus()
})

async function loadChannels() {
  if (!appStore.activePromoId) return
  loading.value = true
  const res = await api<Channel[]>(() => window.api.getChannels(appStore.activePromoId!))
  channels.value = res ?? []
  loading.value = false
}

// ── Filtrage + exclusion du canal d'origine ────────────────────────────────
// On masque le canal d'origine pour eviter le transfert circulaire (peu utile
// et generateur de confusion : le message y existe deja).
const visibleChannels = computed<Channel[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const originId = props.message?.channel_id ?? null
  return channels.value.filter(ch => {
    if (originId != null && ch.id === originId) return false
    if (!q) return true
    return ch.name.toLowerCase().includes(q) || (ch.category ?? '').toLowerCase().includes(q)
  })
})

// Groupement par categorie pour la lisibilite (cohorts / promos / projets...).
interface ChannelGroup { category: string; items: Channel[] }
const groupedChannels = computed<ChannelGroup[]>(() => {
  const map = new Map<string, Channel[]>()
  for (const ch of visibleChannels.value) {
    const cat = ch.category?.trim() || 'Sans catégorie'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(ch)
  }
  return [...map.entries()]
    .map(([category, items]) => ({ category, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.category.localeCompare(b.category))
})

function channelIcon(ch: Channel) {
  if (ch.is_private) return Lock
  if (ch.type === 'annonce') return Megaphone
  return Hash
}

// ── Envoi du transfert ─────────────────────────────────────────────────────
// Format du message transfere : entete markdown + quote du contenu original +
// permalien cursus:// pour que le destinataire puisse ouvrir le message source.
function buildForwardContent(ch: Channel): string {
  const m = props.message!
  const permalink = m.channel_id
    ? `cursus://channel/${m.channel_id}/message/${m.id}`
    : `cursus://dm/${m.dm_student_id ?? 0}/message/${m.id}`
  const quoted = m.content
    .split('\n')
    .map(l => `> ${l}`)
    .join('\n')
  const comment = additionalComment.value.trim()
  const parts = [
    `**Message transféré de ${m.author_name}** — [Voir l'original](${permalink})`,
    quoted,
  ]
  if (comment) parts.push('', comment)
  return parts.join('\n')
}

async function forwardTo(ch: Channel) {
  if (!props.message || sendingTo.value != null) return
  sendingTo.value = ch.id
  try {
    const content = buildForwardContent(ch)
    const res = await window.api.sendMessage({
      channelId: ch.id,
      channelName: ch.name,
      promoId: appStore.activePromoId ?? undefined,
      authorName: appStore.currentUser?.name ?? 'Moi',
      authorType: appStore.currentUser?.type ?? 'student',
      content,
    })
    if (res?.ok) {
      showToast(`Message transféré dans #${ch.name}.`, 'success')
      emit('forwarded', ch.id)
      emit('update:modelValue', false)
    } else {
      showToast('Échec du transfert.', 'error')
    }
  } catch {
    showToast('Erreur lors du transfert.', 'error')
  } finally {
    sendingTo.value = null
  }
}

// Apercu compact du message source (tronque pour ne pas envahir la modale)
const messagePreview = computed(() => {
  const c = props.message?.content ?? ''
  const flat = c.replace(/\n+/g, ' ').trim()
  return flat.length > 140 ? flat.slice(0, 140) + '…' : flat
})
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Transférer le message"
    max-width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="message" class="fm-body">
      <!-- Apercu du message source -->
      <div class="fm-preview">
        <div class="fm-preview-label">Message d'origine</div>
        <div class="fm-preview-content">
          <span class="fm-preview-author">{{ message.author_name }}</span>
          <span class="fm-preview-text">{{ messagePreview }}</span>
        </div>
      </div>

      <!-- Commentaire optionnel -->
      <label class="fm-comment-label" for="fm-comment">
        Ajouter un commentaire <span class="fm-comment-hint">(optionnel)</span>
      </label>
      <textarea
        id="fm-comment"
        v-model="additionalComment"
        class="fm-comment"
        rows="2"
        placeholder="Ex : « J'ai trouvé ça utile pour le projet »"
      />

      <!-- Recherche -->
      <div class="fm-search">
        <Search :size="13" class="fm-search-icon" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          class="fm-search-input"
          placeholder="Rechercher un canal…"
          aria-label="Rechercher un canal de destination"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="fm-search-clear"
          aria-label="Effacer la recherche"
          @click="searchQuery = ''"
        >
          <X :size="11" />
        </button>
      </div>

      <!-- Liste des canaux -->
      <div class="fm-list">
        <div v-if="loading" class="fm-empty">Chargement…</div>
        <div v-else-if="!visibleChannels.length" class="fm-empty">
          <p>Aucun canal {{ searchQuery ? 'ne correspond' : 'disponible' }}.</p>
        </div>
        <template v-else>
          <div v-for="group in groupedChannels" :key="group.category" class="fm-group">
            <div class="fm-group-label">{{ group.category }}</div>
            <button
              v-for="ch in group.items"
              :key="ch.id"
              type="button"
              class="fm-channel"
              :disabled="sendingTo != null"
              @click="forwardTo(ch)"
            >
              <component :is="channelIcon(ch)" :size="14" class="fm-channel-icon" />
              <span class="fm-channel-name">{{ ch.name }}</span>
              <span v-if="ch.is_private" class="fm-channel-tag">privé</span>
              <span v-else-if="ch.type === 'annonce'" class="fm-channel-tag fm-channel-tag--annonce">annonces</span>
              <Forward v-if="sendingTo !== ch.id" :size="14" class="fm-channel-forward" />
              <span v-else class="fm-channel-spinner" aria-hidden="true" />
            </button>
          </div>
        </template>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.fm-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 20px 20px;
}

/* ── Apercu du message source ─────────────────────────────────────────── */
.fm-preview {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
}
.fm-preview-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .4px;
  margin-bottom: 4px;
}
.fm-preview-content {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.fm-preview-author {
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
}
.fm-preview-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

/* ── Commentaire optionnel ────────────────────────────────────────────── */
.fm-comment-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.fm-comment-hint {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  color: var(--text-muted);
  font-style: italic;
}
.fm-comment {
  width: 100%;
  min-height: 52px;
  resize: vertical;
  padding: 8px 10px;
  font-family: var(--font);
  font-size: 13px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.fm-comment:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}

/* ── Recherche ────────────────────────────────────────────────────────── */
.fm-search {
  position: relative;
  display: flex;
  align-items: center;
}
.fm-search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
  pointer-events: none;
}
.fm-search-input {
  width: 100%;
  padding: 8px 32px 8px 30px;
  font-family: var(--font);
  font-size: 13px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.fm-search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}
.fm-search-clear {
  position: absolute;
  right: 6px;
  background: var(--bg-hover);
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.fm-search-clear:hover { background: var(--color-danger); color: #fff; }

/* ── Liste des canaux ─────────────────────────────────────────────────── */
.fm-list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fm-group {
  display: flex;
  flex-direction: column;
}
.fm-group-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 6px 10px 4px;
}
.fm-channel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background var(--t-fast), color var(--t-fast);
}
.fm-channel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.fm-channel:hover:not(:disabled) .fm-channel-forward { color: var(--accent); opacity: 1; }
.fm-channel:disabled { opacity: .5; cursor: wait; }

.fm-channel-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.fm-channel-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fm-channel-tag {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 2px 7px;
  border-radius: var(--radius-lg);
  background: var(--bg-active);
  color: var(--text-muted);
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.fm-channel-tag--annonce {
  background: rgba(var(--color-warning-rgb), .12);
  color: var(--color-warning);
  border-color: rgba(var(--color-warning-rgb), .3);
}
.fm-channel-forward {
  color: var(--text-muted);
  opacity: .5;
  transition: color var(--t-fast), opacity var(--t-fast);
  flex-shrink: 0;
}
.fm-channel-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(var(--accent-rgb), .25);
  border-top-color: var(--accent);
  animation: fm-spin .8s linear infinite;
  flex-shrink: 0;
}
@keyframes fm-spin {
  to { transform: rotate(360deg); }
}

.fm-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.fm-empty p { margin: 0; }
</style>
