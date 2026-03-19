<script setup lang="ts">
import { computed } from 'vue'
import { CheckCheck, AtSign, MessageSquare, X } from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { useRouter } from 'vue-router'

const emit = defineEmits<{ close: [] }>()

const appStore      = useAppStore()
const messagesStore = useMessagesStore()
const router        = useRouter()

const mentions = computed(() =>
  appStore.notificationHistory.filter((n) => n.isMention),
)

const others = computed(() =>
  appStore.notificationHistory.filter((n) => !n.isMention),
)

const hasAny     = computed(() => appStore.notificationHistory.length > 0)
const hasUnread  = computed(() => appStore.notificationHistory.some((n) => !n.read))

async function goTo(entry: typeof appStore.notificationHistory[number]) {
  emit('close')
  const promoId = entry.promoId ?? appStore.activePromoId ?? 0
  if (entry.dmStudentId) {
    // Pour les DMs : naviguer vers /messages, l'utilisateur clique sur le DM en sidebar
    appStore.markDmRead(entry.authorName)
    await router.push('/messages')
  } else if (entry.channelId) {
    appStore.openChannel(entry.channelId, promoId, entry.channelName)
    await router.push('/messages')
    await messagesStore.fetchMessages()
  }
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000)     return 'À l\'instant'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="notif-panel" role="dialog" aria-label="Centre de notifications" aria-live="polite">
    <!-- En-tête -->
    <div class="notif-header">
      <span class="notif-title">Notifications</span>
      <div class="notif-header-actions">
        <button
          v-if="hasUnread"
          class="notif-mark-all"
          title="Tout marquer comme lu"
          @click="appStore.markAllRead()"
        >
          <CheckCheck :size="13" />
          Tout lire
        </button>
        <button class="notif-close-btn" aria-label="Fermer" @click="emit('close')">
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Vide -->
    <div v-if="!hasAny" class="notif-empty">
      <MessageSquare :size="28" class="notif-empty-icon" />
      <p>Aucune notification</p>
    </div>

    <template v-else>
      <!-- Section Mentions -->
      <div v-if="mentions.length" class="notif-section">
        <div class="notif-section-title">
          <AtSign :size="11" />
          Mentions
        </div>
        <button
          v-for="n in mentions"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.read }"
          @click="goTo(n)"
        >
          <div class="notif-item-dot" :class="{ visible: !n.read }" />
          <div class="notif-item-body">
            <span class="notif-item-author">{{ n.authorName }}</span>
            <span class="notif-item-channel">{{ n.dmStudentId ? 'Message direct' : `#${n.channelName}` }}</span>
          </div>
          <span class="notif-item-time">{{ formatTime(n.timestamp) }}</span>
        </button>
      </div>

      <!-- Section Messages non lus -->
      <div v-if="others.length" class="notif-section">
        <div class="notif-section-title">
          <MessageSquare :size="11" />
          Messages
        </div>
        <button
          v-for="n in others"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.read }"
          @click="goTo(n)"
        >
          <div class="notif-item-dot" :class="{ visible: !n.read }" />
          <div class="notif-item-body">
            <span class="notif-item-author">{{ n.authorName }}</span>
            <span class="notif-item-channel">{{ n.dmStudentId ? 'Message direct' : `#${n.channelName}` }}</span>
          </div>
          <span class="notif-item-time">{{ formatTime(n.timestamp) }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notif-panel {
  position: absolute;
  left: calc(100% + 10px);
  bottom: 0;
  width: 280px;
  max-height: 420px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 200;
}

/* ── En-tête ── */
.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.notif-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
}

.notif-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.notif-mark-all {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: background .1s;
}
.notif-mark-all:hover { background: rgba(74, 144, 217, .12); }

.notif-close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 5px;
  display: flex;
  transition: color .1s, background .1s;
}
.notif-close-btn:hover { color: var(--text-primary); background: rgba(255,255,255,.07); }

/* ── Vide ── */
.notif-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--text-muted);
  font-size: 12.5px;
}
.notif-empty-icon { opacity: .35; }
.notif-empty p { margin: 0; }

/* ── Sections ── */
.notif-section {
  overflow-y: auto;
  max-height: 175px;
}

.notif-section-title {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-muted);
  background: var(--bg-modal);
  position: sticky;
  top: 0;
  z-index: 1;
}

/* ── Items ── */
.notif-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background .08s;
}
.notif-item:hover { background: rgba(255,255,255,.05); }
.notif-item.unread { background: rgba(74, 144, 217, .05); }
.notif-item.unread:hover { background: rgba(74, 144, 217, .1); }

.notif-item-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .15s;
}
.notif-item-dot.visible { opacity: 1; }

.notif-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.notif-item-author {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-item-channel {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-item-time {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
