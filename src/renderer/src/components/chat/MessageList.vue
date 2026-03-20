<script setup lang="ts">
import { computed, watch, nextTick, ref, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useMessagesStore } from '@/stores/messages'
import MessageBubble from './MessageBubble.vue'
import { formatDateSeparator } from '@/utils/date'
import type { Message } from '@/types'

const store  = useMessagesStore()
const listEl = ref<HTMLElement | null>(null)

// ── Initialisation des réactions ──────────────────────────────────────────
watch(
  () => store.messages,
  (msgs) => msgs.forEach((m) => store.initReactions(m.id, m.reactions)),
  { immediate: true },
)

// ── Bouton "retour en bas" ────────────────────────────────────────────────
const showScrollBtn  = ref(false)
const unreadBelowCount = ref(0)

function onScroll() {
  if (!listEl.value) return
  const el = listEl.value
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollBtn.value = distFromBottom > 200
}

function scrollToBottom() {
  if (!listEl.value) return
  // S'il y a des non-lus, scroller vers le premier non-lu
  if (store.firstUnreadId) {
    const marker = listEl.value.querySelector('.unread-divider')
    if (marker) {
      marker.scrollIntoView({ block: 'center', behavior: 'smooth' })
      unreadBelowCount.value = 0
      return
    }
  }
  listEl.value.scrollTop = listEl.value.scrollHeight
  unreadBelowCount.value = 0
}

// ── Scroll automatique ────────────────────────────────────────────────────
let initialScrollDone = false

watch(
  () => store.messages.length,
  () => nextTick(() => {
    if (!listEl.value) return
    const el = listEl.value

    if (!initialScrollDone && store.firstUnreadId) {
      const marker = el.querySelector('.unread-divider')
      if (marker) {
        marker.scrollIntoView({ block: 'center' })
        initialScrollDone = true
        return
      }
    }

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distFromBottom < 120

    if (atBottom || !initialScrollDone) {
      el.scrollTop = el.scrollHeight
      initialScrollDone = true
      unreadBelowCount.value = 0
    } else {
      // Nouveau message arrivé alors qu'on n'est pas en bas
      unreadBelowCount.value++
    }
  }),
)

watch(() => store.loading, (loading) => {
  if (loading) { initialScrollDone = false; unreadBelowCount.value = 0 }
})

// ── Infinite scroll vers le haut — IntersectionObserver ──────────────────
const sentinelEl = ref<HTMLElement | null>(null)
let   observer: IntersectionObserver | null = null

async function loadMore() {
  if (!listEl.value || !store.hasMore || store.loadingMore) return

  const el         = listEl.value
  const prevHeight = el.scrollHeight
  const prevTop    = el.scrollTop

  await store.loadOlderMessages()
  await nextTick()

  el.scrollTop = prevTop + (el.scrollHeight - prevHeight)
}

onMounted(() => {
  listEl.value?.addEventListener('scroll', onScroll, { passive: true })
  if (!sentinelEl.value) return
  observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) loadMore() },
    { root: listEl.value, threshold: 0.1 },
  )
  observer.observe(sentinelEl.value)
})

onBeforeUnmount(() => {
  listEl.value?.removeEventListener('scroll', onScroll)
  observer?.disconnect()
  observer = null
})

// ── Groupement par date ────────────────────────────────────────────────────
interface GroupedMessage { msg: Message; grouped: boolean; isFirstUnread: boolean }
interface DateGroup      { date: string; messages: GroupedMessage[] }

const dateGroups = computed<DateGroup[]>(() => {
  const groups: DateGroup[] = []
  let lastDate  = ''
  let lastMsg: Message | null = null
  let unreadMarked = false

  for (const msg of store.messages) {
    const date = new Date(msg.created_at).toDateString()
    if (date !== lastDate) {
      lastDate = date
      lastMsg  = null
      groups.push({ date: formatDateSeparator(msg.created_at), messages: [] })
    }
    const grp = groups[groups.length - 1]

    const isFirstUnread =
      !unreadMarked &&
      store.firstUnreadId !== null &&
      msg.id === store.firstUnreadId

    if (isFirstUnread) unreadMarked = true

    grp.messages.push({ msg, grouped: store.isGrouped(msg, lastMsg), isFirstUnread })
    lastMsg = msg
  }
  return groups
})
</script>

<template>
  <div ref="listEl" id="messages-list" class="messages-list">

    <!-- Squelette de chargement -->
    <Transition name="skel-fade">
      <div v-if="store.loading" class="skel-container">
        <div v-for="i in 6" :key="i" class="skel-msg-row">
          <div class="skel skel-avatar" />
          <div class="skel-msg-body">
            <div class="skel skel-line skel-w30" />
            <div class="skel skel-line skel-w90" />
            <div v-if="i % 3 !== 0" class="skel skel-line skel-w70" />
          </div>
        </div>
      </div>
    </Transition>

    <template v-if="!store.loading">
      <template v-if="store.messages.length">
        <div ref="sentinelEl" class="scroll-sentinel" aria-hidden="true">
          <div v-if="store.loadingMore" class="load-more-indicator">
            <span class="load-more-dots">
              <span /><span /><span />
            </span>
          </div>
          <div v-else-if="!store.hasMore && store.messages.length > 0" class="conversation-start">
            <span class="conversation-start-icon">💬</span>
            <span class="conversation-start-text">Début de la conversation</span>
          </div>
        </div>

        <!-- Messages groupés par date -->
        <template v-for="group in dateGroups" :key="group.date">
          <div class="date-separator"><span>{{ group.date }}</span></div>

          <TransitionGroup name="msg-fade" tag="div" class="msg-group-wrap">
            <template v-for="{ msg, grouped, isFirstUnread } in group.messages" :key="msg.id">
              <div v-if="isFirstUnread" :key="`unread-${msg.id}`" class="unread-divider">
                <span class="unread-divider-label">Nouveaux messages</span>
              </div>

              <MessageBubble
                :msg="msg"
                :grouped="grouped"
                :search-term="store.searchTerm"
                :class="{ 'msg-highlight': store.searchTerm && msg.content.toLowerCase().includes(store.searchTerm.toLowerCase()) }"
              />
            </template>
          </TransitionGroup>
        </template>
      </template>

      <!-- État vide -->
      <div v-else class="empty-state">
        <p>{{ store.searchTerm ? 'Aucun message ne correspond à cette recherche.' : "Aucun message pour l'instant." }}</p>
      </div>
    </template>

    <!-- Bouton retour en bas -->
    <Transition name="scroll-btn-fade">
      <button
        v-if="showScrollBtn"
        class="scroll-to-bottom-btn"
        :class="{ 'has-badge': unreadBelowCount > 0 }"
        aria-label="Retourner en bas"
        @click="scrollToBottom"
      >
        <ChevronDown :size="18" />
        <span v-if="unreadBelowCount > 0" class="scroll-badge">
          {{ unreadBelowCount > 99 ? '99+' : unreadBelowCount }}
        </span>
      </button>
    </Transition>

  </div>
</template>

<style scoped>
/* ── Messages list doit être position:relative pour le bouton scroll ── */
.messages-list { position: relative; }

/* ── Wrapper de groupe (TransitionGroup tag) ── */
.msg-group-wrap { display: contents; }

/* ── Animation d'entrée — nouveaux messages seulement ── */
.msg-fade-enter-active {
  transition: opacity .18s ease-out, transform .18s ease-out;
}
.msg-fade-enter-from {
  opacity: 0;
  transform: translateY(7px);
}

/* ── Sentinelle ── */
.scroll-sentinel { min-height: 1px; flex-shrink: 0; }

/* ── Début de conversation ── */
.conversation-start {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 24px 20px 12px; color: var(--text-muted); user-select: none;
}
.conversation-start-icon { font-size: 28px; opacity: .6; }
.conversation-start-text { font-size: 12px; font-weight: 600; letter-spacing: .3px; }

/* ── Indicateur chargement anciens messages ── */
.load-more-indicator { display: flex; justify-content: center; padding: 8px 0 4px; }
.load-more-dots { display: inline-flex; gap: 5px; align-items: center; }
.load-more-dots span {
  display: block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--text-muted);
  animation: dot-bounce 1.2s ease-in-out infinite;
}
.load-more-dots span:nth-child(2) { animation-delay: .2s; }
.load-more-dots span:nth-child(3) { animation-delay: .4s; }
@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(.6); opacity: .4; }
  40%           { transform: scale(1);  opacity: 1; }
}

/* ── Séparateur de date ── */
.date-separator {
  display: flex; align-items: center; gap: 10px;
  margin: 4px 20px 2px;
  position: sticky; top: 0; z-index: 10;
  isolation: isolate;
}
.date-separator::before, .date-separator::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}
.date-separator span {
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  white-space: nowrap; padding: 3px 10px; border-radius: 20px;
  background: color-mix(in srgb, var(--bg-main) 88%, transparent);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  border: 1px solid var(--border);
}

/* ── Séparateur non-lus ── */
.unread-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 8px 20px; position: relative;
}
.unread-divider::before, .unread-divider::after {
  content: ''; flex: 1; height: 1px;
  background: var(--color-danger); opacity: .5;
}
.unread-divider-label {
  font-size: 11px; font-weight: 700; color: var(--color-danger);
  white-space: nowrap; padding: 0 8px; flex-shrink: 0;
}

/* ── Highlight résultat de recherche ── */
.msg-highlight {
  background: rgba(243,156,18,.06);
  animation: highlight-flash .6s ease-out;
}
@keyframes highlight-flash {
  0%   { background: rgba(243,156,18,.18); }
  100% { background: rgba(243,156,18,.06); }
}

/* ── Skeleton fade ── */
.skel-container { display: flex; flex-direction: column; gap: 14px; padding: 20px 16px; }
.skel-fade-enter-active { transition: opacity .2s ease; }
.skel-fade-leave-active { transition: opacity .15s ease; position: absolute; width: 100%; top: 0; left: 0; }
.skel-fade-enter-from, .skel-fade-leave-to { opacity: 0; }

/* ── Bouton scroll-to-bottom ── */
.scroll-to-bottom-btn {
  position: sticky;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-modal);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,.35);
  transition: background var(--t-fast), color var(--t-fast), transform var(--t-fast), box-shadow var(--t-fast);
  z-index: 20;
  margin: 0 auto;
}
.scroll-to-bottom-btn:hover {
  background: var(--accent);
  color: #fff;
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 6px 20px rgba(74,144,217,.35);
}
.scroll-to-bottom-btn.has-badge { width: auto; border-radius: 18px; padding: 0 10px; gap: 5px; }
.scroll-badge {
  font-size: 11px; font-weight: 700;
  background: var(--color-danger);
  color: #fff; border-radius: 10px;
  padding: 1px 6px; line-height: 1.5;
}

/* Transition bouton scroll */
.scroll-btn-fade-enter-active, .scroll-btn-fade-leave-active { transition: opacity .2s, transform .2s; }
.scroll-btn-fade-enter-from, .scroll-btn-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
