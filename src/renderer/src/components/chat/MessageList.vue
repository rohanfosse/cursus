<script setup lang="ts">
import { computed, watch, nextTick, ref, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown, MessageSquare, Search, Hash, Send } from 'lucide-vue-next'
import { useMessagesStore } from '@/stores/messages'
import { useAppStore } from '@/stores/app'
import MessageBubble from './MessageBubble.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatDateSeparator } from '@/utils/date'
import type { Message } from '@/types'

const store    = useMessagesStore()
const appStore = useAppStore()
const listEl = ref<HTMLElement | null>(null)

// ── Initialisation des réactions ──────────────────────────────────────────
watch(
  () => store.messages,
  (msgs) => {
    for (const m of msgs) {
      if (!store.reactions[m.id]) store.initReactions(m.id, m.reactions)
    }
  },
  { immediate: true },
)

// ── Bouton "retour en bas" ────────────────────────────────────────────────
const showScrollBtn  = ref(false)
const unreadBelowCount = ref(0)

// Throttle via requestAnimationFrame : scroll fire jusqu'a 100+ fois/sec,
// le calcul n'a besoin d'etre fait qu'une fois par frame.
let _scrollRaf: number | null = null
function onScroll() {
  if (_scrollRaf != null) return
  _scrollRaf = requestAnimationFrame(() => {
    _scrollRaf = null
    if (!listEl.value) return
    const el = listEl.value
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    showScrollBtn.value = distFromBottom > 200
  })
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

// ── Infinite scroll vers le haut - IntersectionObserver ──────────────────
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

// Cache de date-strings pour eviter de creer un Date par message a chaque
// recomputation. Cap a 2000 entrees pour eviter une croissance non bornee
// sur une session longue (6-8h).
const _dateCache = new Map<string, string>()
const DATE_CACHE_MAX = 2000
function cachedDateString(createdAt: string): string {
  let ds = _dateCache.get(createdAt)
  if (!ds) {
    ds = new Date(createdAt).toDateString()
    if (_dateCache.size >= DATE_CACHE_MAX) {
      // Eviction LRU simpliste : drop la plus ancienne entree.
      const first = _dateCache.keys().next().value
      if (first !== undefined) _dateCache.delete(first)
    }
    _dateCache.set(createdAt, ds)
  }
  return ds
}

const dateGroups = computed<DateGroup[]>(() => {
  const groups: DateGroup[] = []
  let lastDate  = ''
  let lastMsg: Message | null = null
  let unreadMarked = false

  for (const msg of store.messages) {
    const date = cachedDateString(msg.created_at)
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
  <div
    id="messages-list"
    ref="listEl"
    class="messages-list"
    role="log"
    aria-live="polite"
    aria-relevant="additions"
    aria-label="Messages du canal"
  >

    <!-- Squelette de chargement -->
    <Transition name="skel-fade">
      <div v-if="store.loading" class="skel-container">
        <div class="skel-loading-hint">
          <span class="skel-spinner" />
          <span>Chargement des messages...</span>
        </div>
        <SkeletonLoader variant="message" :rows="6" />
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
            <div class="conversation-start-line" />
          </div>
        </div>

        <!-- Messages groupés par date.
             Chaque groupe a son propre wrapper .date-group : ainsi la pill
             sticky est contenue par son groupe et est "poussée" hors viewport
             quand le groupe sort, au lieu de s'empiler sur la suivante. -->
        <section
          v-for="group in dateGroups"
          :key="group.date"
          class="date-group"
        >
          <div class="date-separator"><span>{{ group.date }}</span></div>

          <!-- Transition desactivee quand on charge de l'historique (infinite scroll
               haut) : eviter le pop-in disgracieux de messages qui apparaissent
               au-dessus de la viewport de l'utilisateur. -->
          <TransitionGroup :name="store.loadingMore ? '' : 'msg-fade'" tag="div" class="msg-group-wrap">
            <template v-for="{ msg, grouped, isFirstUnread } in group.messages" :key="msg.id">
              <div v-if="isFirstUnread" :key="`unread-${msg.id}`" class="unread-divider">
                <span class="unread-divider-label">Nouveaux messages</span>
              </div>

              <MessageBubble
                v-memo="[
                  msg.id,
                  msg.content,
                  msg.edited,
                  msg.is_pinned,
                  msg.poll_votes,
                  grouped,
                  store.searchTerm,
                  store.reactions[msg.id],
                  store.highlightMessageId === msg.id,
                ]"
                :msg="msg"
                :grouped="grouped"
                :search-term="store.searchTerm"
                :class="{ 'msg-highlight': store.searchTerm && msg.content.toLowerCase().includes(store.searchTerm.toLowerCase()) }"
              />
            </template>
          </TransitionGroup>
        </section>
      </template>

      <!-- État vide -->
      <template v-else>
        <EmptyState
          v-if="store.searchTerm"
          size="lg"
          tone="warning"
          :icon="Search"
          :title="`Aucun résultat pour « ${store.searchTerm} »`"
          subtitle="Essayez des mots-clés différents ou vérifiez l'orthographe."
        />
        <EmptyState
          v-else-if="appStore.activeChannelId"
          size="lg"
          tone="accent"
          :icon="Hash"
          :title="`Bienvenue dans #${appStore.activeChannelName ?? 'ce canal'}`"
          subtitle="C'est le tout début de ce canal. Envoyez un message pour lancer la discussion."
        >
          <div class="empty-hint">
            <Send :size="12" />
            <span>Écrivez dans le champ ci-dessous et appuyez sur Entrée</span>
          </div>
        </EmptyState>
        <EmptyState
          v-else-if="appStore.activeDmStudentId"
          size="lg"
          tone="success"
          :icon="MessageSquare"
          title="Nouvelle conversation"
          subtitle="Aucun message pour l'instant. Envoyez le premier !"
        />
        <EmptyState
          v-else
          size="lg"
          :icon="MessageSquare"
          title="Sélectionnez un salon"
          subtitle="Choisissez un salon ou une conversation dans la barre latérale."
        />
      </template>
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

/* ── Animation d'entrée - nouveaux messages seulement ── */
.msg-fade-enter-active {
  transition: opacity var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out);
}
.msg-fade-enter-from {
  opacity: 0;
  transform: translateY(7px);
}

/* ── Sentinelle ── */
.scroll-sentinel { min-height: 1px; flex-shrink: 0; }

/* ── Début de conversation ── */
.conversation-start {
  display: flex; align-items: center; padding: 16px 20px 8px; user-select: none;
}
.conversation-start-line {
  flex: 1; height: 1px;
  background: var(--border, var(--border));
}

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

/* ── Wrapper d'un jour ──
   Sert de bloc de scoping pour le sticky de .date-separator : tant que ce
   wrapper est dans la viewport, la pill reste collée en haut ; dès qu'on
   sort du jour, le wrapper sort et la pill avec lui (au lieu de s'empiler
   sur celle du jour suivant comme avant le fix). */
.date-group { position: relative; }

/* ── Separateur de date (v2.241) ──
   Pill compacte centrée, sticky, SANS halo ring : la version précédente
   ajoutait un box-shadow spread de 4px couleur bg-main, qui apparaissait
   comme des barres horizontales de chaque côté de la pill lors du scroll
   quand elle chevauchait un message. Pour garder la lisibilité on s'appuie
   maintenant uniquement sur le backdrop-filter + un fond opaque. */
.date-separator {
  display: flex;
  justify-content: center;
  margin: 10px 0 4px;
  position: sticky;
  top: 6px;
  z-index: 10;
  pointer-events: none; /* laisse le clic traverser vers les messages */
  isolation: isolate;
}
.date-separator span {
  pointer-events: auto; /* mais la pill reste selectionnable / inspectable */
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
  padding: 5px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  backdrop-filter: blur(10px) saturate(1.3);
  -webkit-backdrop-filter: blur(10px) saturate(1.3);
  border: 1px solid var(--border);
  letter-spacing: .3px;
  text-transform: capitalize;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .18);
  transition: box-shadow var(--motion-fast) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .date-separator span { transition: none; }
}

/* ── Separateur non-lus (v2.240) ──
   La ligne rouge pleine largeur etait justifiee ici (elle signale un boundary
   important), mais on la rend plus fine + gradient qui fade sur les cotes
   pour ne pas couper brutalement un message long. */
.unread-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 20px;
  position: relative;
}
.unread-divider::before,
.unread-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--color-danger) 25%,
    var(--color-danger) 75%,
    transparent
  );
  opacity: .55;
}
/* L'apres-label fade a droite (miroir) */
.unread-divider::after {
  background: linear-gradient(
    to left,
    transparent,
    var(--color-danger) 25%,
    var(--color-danger) 75%,
    transparent
  );
}
.unread-divider-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--color-danger);
  white-space: nowrap;
  padding: 2px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-main) 85%, transparent);
  border: 1px solid rgba(var(--color-danger-rgb), .3);
  letter-spacing: .3px;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* ── Highlight resultat de recherche / jump to message ── */
.msg-highlight {
  animation: highlight-flash 2s ease-out forwards;
  border-left: 3px solid var(--color-warning);
  padding-left: 5px;
}
@keyframes highlight-flash {
  0%   { background: color-mix(in srgb, var(--color-warning) 35%, transparent); }
  30%  { background: color-mix(in srgb, var(--color-warning) 28%, transparent); }
  100% { background: transparent; border-left-color: transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .msg-highlight { animation: none; background: color-mix(in srgb, var(--color-warning) 10%, transparent); }
}

/* ── Skeleton fade ── */
.skel-container { display: flex; flex-direction: column; gap: 14px; padding: 20px 16px; }
.skel-loading-hint {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  font-size: 12px; color: var(--text-muted); padding: 8px 0;
}
.skel-spinner {
  width: 14px; height: 14px; border: 2px solid var(--border-input);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .skel-spinner { animation: none; }
}
.skel-fade-enter-active { transition: opacity var(--motion-base) var(--ease-out); }
.skel-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); position: absolute; width: 100%; top: 0; left: 0; }
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
  color: white;
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 6px 20px rgba(var(--accent-rgb),.35);
}
.scroll-to-bottom-btn.has-badge { width: auto; border-radius: 18px; padding: 0 10px; gap: 5px; }
.scroll-badge {
  font-size: 11px; font-weight: 700;
  background: var(--color-danger);
  color: white; border-radius: 10px;
  padding: 1px 6px; line-height: 1.5;
}
@media (prefers-reduced-motion: reduce) {
  .scroll-to-bottom-btn:hover { transform: translateX(-50%); }
}

/* Transition bouton scroll */
.scroll-btn-fade-enter-active, .scroll-btn-fade-leave-active { transition: opacity .2s, transform .2s; }
.scroll-btn-fade-enter-from, .scroll-btn-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
