<script setup lang="ts">
  import { computed, watch, nextTick, ref, onMounted, onBeforeUnmount } from 'vue'
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

  // ── Scroll automatique ────────────────────────────────────────────────────
  // - Premier chargement + marqueur de non-lu → scroller vers le divider
  // - Sinon → scroll vers le bas uniquement si déjà en bas (± 120px)
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

      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      if (atBottom || !initialScrollDone) {
        el.scrollTop = el.scrollHeight
        initialScrollDone = true
      }
    }),
  )

  // Réinitialiser le scroll à chaque changement de canal (loading passe à true)
  watch(() => store.loading, (loading) => {
    if (loading) initialScrollDone = false
  })

  // ── Infinite scroll vers le haut — IntersectionObserver ──────────────────
  /**
   * Pourquoi IntersectionObserver plutôt qu'un écouteur de scroll ?
   *   - Aucun calcul de scrollTop à chaque pixel de défilement (0 overhead JS)
   *   - Le callback est déclenché par le navigateur hors du thread principal
   *   - Cleanup explicite dans onBeforeUnmount → zéro fuite mémoire
   *
   * Stratégie scroll-anchor (évite le saut de vue) :
   *   1. Mémoriser scrollHeight + scrollTop AVANT le prepend
   *   2. Attendre que le store mette à jour messages.value (await loadOlderMessages)
   *   3. Attendre la mise à jour du DOM (await nextTick)
   *   4. scrollTop = ancienScrollTop + (nouvScrollHeight - ancienScrollHeight)
   *      → l'utilisateur reste visuellement au même message
   */
  const sentinelEl = ref<HTMLElement | null>(null)
  let   observer: IntersectionObserver | null = null

  async function loadMore() {
    if (!listEl.value || !store.hasMore || store.loadingMore) return

    const el         = listEl.value
    const prevHeight = el.scrollHeight
    const prevTop    = el.scrollTop

    await store.loadOlderMessages()
    await nextTick()

    // Restaurer la position visuelle
    el.scrollTop = prevTop + (el.scrollHeight - prevHeight)
  }

  onMounted(() => {
    if (!sentinelEl.value) return
    observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { root: listEl.value, threshold: 0.1 },
    )
    observer.observe(sentinelEl.value)
  })

  onBeforeUnmount(() => {
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

    <!-- Squelette de chargement (canal en cours de chargement) -->
    <template v-if="store.loading">
      <div v-for="i in 5" :key="i" class="skel-msg-row">
        <div class="skel skel-avatar" />
        <div class="skel-msg-body">
          <div class="skel skel-line skel-w30" />
          <div class="skel skel-line skel-w90" />
          <div class="skel skel-line skel-w70" />
        </div>
      </div>
    </template>

    <template v-else-if="store.messages.length">
      <!--
        Sentinelle en haut de la liste.
        Quand elle devient visible (scroll vers le haut), l'IntersectionObserver
        déclenche loadMore(). Elle est invisible mais occupe de la hauteur pour
        que l'observer puisse la détecter correctement.
      -->
      <div ref="sentinelEl" class="scroll-sentinel" aria-hidden="true">
        <!-- Indicateur de chargement des anciens messages -->
        <div v-if="store.loadingMore" class="load-more-indicator">
          <span class="load-more-dots">
            <span /><span /><span />
          </span>
        </div>
      </div>

      <!-- Messages groupés par date -->
      <template v-for="group in dateGroups" :key="group.date">
        <!--
          position: sticky; top: 0  → le séparateur de date reste visible
          pendant le scroll, comme dans Slack/Discord.
          backdrop-filter: blur()   → effet "verre dépoli" sur les messages derrière.
        -->
        <div class="date-separator"><span>{{ group.date }}</span></div>

        <template v-for="{ msg, grouped, isFirstUnread } in group.messages" :key="msg.id">
          <!-- Séparateur "Nouveaux messages" -->
          <div v-if="isFirstUnread" class="unread-divider">
            <span class="unread-divider-label">Nouveaux messages</span>
          </div>

          <MessageBubble
            :msg="msg"
            :grouped="grouped"
            :search-term="store.searchTerm"
          />
        </template>
      </template>
    </template>

    <!-- État vide -->
    <div v-else class="empty-state">
      <p>{{ store.searchTerm ? 'Aucun message ne correspond à cette recherche.' : "Aucun message pour l'instant." }}</p>
    </div>

  </div>
</template>

<style scoped>
/* ── Sentinelle de scroll (invisible, uniquement pour l'observer) ── */
.scroll-sentinel {
  height: 1px;
  flex-shrink: 0;
}

/* ── Indicateur de chargement des anciens messages ── */
.load-more-indicator {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.load-more-dots {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.load-more-dots span {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: dot-bounce 1.2s ease-in-out infinite;
}

.load-more-dots span:nth-child(2) { animation-delay: .2s; }
.load-more-dots span:nth-child(3) { animation-delay: .4s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(.6); opacity: .4; }
  40%           { transform: scale(1);  opacity: 1; }
}

/* ── Séparateur de date — sticky ── */
/*
 * position: sticky + backdrop-filter crée un effet "verre dépoli" à la Slack :
 * le label de date reste en haut pendant le défilement et le contenu en-dessous
 * est flou, signalant clairement que l'on change de jour.
 */
.date-separator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 20px 2px;
  position: sticky;
  top: 0;
  z-index: 10;
  /* Forcer un contexte de rendu pour que backdrop-filter fonctionne */
  isolation: isolate;
}

.date-separator::before,
.date-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.date-separator span {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
  padding: 3px 10px;
  border-radius: 20px;
  /* Fond semi-opaque + blur pour l'effet dépoli */
  background: color-mix(in srgb, var(--bg-main) 88%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid var(--border);
}

/* ── Séparateur "Nouveaux messages" ── */
.unread-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 20px;
  position: relative;
}

.unread-divider::before,
.unread-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-danger);
  opacity: .5;
}

.unread-divider-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-danger);
  white-space: nowrap;
  padding: 0 8px;
  flex-shrink: 0;
}
</style>
