/**
 * TeacherWidgets.vue
 * ---------------------------------------------------------------------------
 * Seven dashboard widgets: DMs, saved messages, mentions, channel activity,
 * next 48h agenda, forgotten drafts, and devoirs without resources.
 */
<script setup lang="ts">
import { ref } from 'vue'
import {
  MessageSquare, Bookmark, Trash2, ChevronRight,
  AtSign, CalendarClock, EyeOff, FileText, FileQuestion,
  Mic, Clock, CheckCircle2,
} from 'lucide-vue-next'
import { deadlineLabel } from '@/utils/date'
import { avatarColor } from '@/utils/format'
import { useConfirm } from '@/composables/useConfirm'
import { useWidgetGrid } from '@/composables/useWidgetGrid'
import { useTeacherBento } from '@/composables/useTeacherBento'
import WidgetShell from './WidgetShell.vue'
import type { WidgetSize } from '@/types/widgets'
import type { GanttRow } from '@/composables/useDashboardTeacher'
import type { SavedMessage, AgendaItem } from '@/composables/useDashboardWidgets'

const { confirm } = useConfirm()
const { getWidgetSize, setWidgetSize } = useTeacherBento()
const gridRef = ref<HTMLElement | null>(null)
const { clampSize, gridStyle } = useWidgetGrid(gridRef)

defineProps<{
  unreadDmEntries: { name: string; count: number }[]
  totalUnreadDms: number
  savedMessages: SavedMessage[]
  unreadMentions: { id: string; authorName: string; channelId: number | null; channelName: string }[]
  totalUnreadMentions: number
  recentChannelActivity: { id: string; authorName: string; channelId: number | null; channelName: string; timestamp: number; read: boolean }[]
  next48h: AgendaItem[]
  forgottenDrafts: GanttRow[]
  devoirsWithoutResources: GanttRow[]
}>()

const emit = defineEmits<{
  openDmFromDashboard: [name: string]
  removeSavedMessage: [id: number]
  goToSavedMessage: [msg: SavedMessage]
  goToChannel: [channelId: number, channelName: string]
  publishDraft: [id: number]
  openGestionDevoir: [travailId: number]
}>()
</script>

<template>
  <!-- DMs non lus -->
  <div v-if="unreadDmEntries.length" class="db-unread-dms">
    <h4 class="db-section-title"><MessageSquare :size="14" /> Messages directs non lus <span class="db-badge-count">{{ totalUnreadDms }}</span></h4>
    <div class="db-unread-list">
      <button
        v-for="entry in unreadDmEntries"
        :key="entry.name"
        class="db-unread-item"
        @click="emit('openDmFromDashboard', entry.name)"
      >
        <div class="db-unread-avatar" :style="{ background: avatarColor(entry.name) }">
          {{ entry.name.slice(0, 2).toUpperCase() }}
        </div>
        <span class="db-unread-name">{{ entry.name }}</span>
        <span class="db-unread-badge">{{ entry.count }} non lu{{ entry.count > 1 ? 's' : '' }}</span>
        <ChevronRight :size="12" class="db-unread-arrow" />
      </button>
    </div>
  </div>

  <!-- Messages sauvegardés -->
  <div v-if="savedMessages.length" class="db-saved-messages">
    <h4 class="db-section-title"><Bookmark :size="14" /> Messages sauvegardés</h4>
    <div class="db-saved-list">
      <div
        v-for="msg in savedMessages.slice(0, 5)"
        :key="msg.id"
        class="db-saved-item"
        @click="emit('goToSavedMessage', msg)"
      >
        <div class="db-saved-avatar" :style="{ background: avatarColor(msg.authorName) }">
          {{ msg.authorInitials }}
        </div>
        <div class="db-saved-body">
          <span class="db-saved-author">{{ msg.authorName }}</span>
          <span class="db-saved-content">{{ msg.content }}</span>
          <span class="db-saved-meta">
            {{ msg.isDm ? 'DM' : '#' + (msg.channelName ?? 'canal') }}
            · {{ new Date(msg.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }}
          </span>
        </div>
        <button
          class="db-saved-remove"
          title="Retirer des favoris"
          @click.stop="emit('removeSavedMessage', msg.id)"
        >
          <Trash2 :size="12" />
        </button>
      </div>
    </div>
    <span v-if="savedMessages.length > 5" class="db-saved-more">
      +{{ savedMessages.length - 5 }} autre{{ savedMessages.length - 5 > 1 ? 's' : '' }}
    </span>
  </div>

  <!-- Widgets Communication + Organisation (grille responsive) -->
  <div
    v-if="unreadMentions.length || recentChannelActivity.length || next48h.length || forgottenDrafts.length || devoirsWithoutResources.length"
    ref="gridRef"
    class="db-widgets-grid"
    :style="gridStyle"
  >

    <!-- Mentions @ non lues -->
    <div v-if="unreadMentions.length" class="db-widget">
      <h4 class="db-section-title">
        <AtSign :size="14" /> Mentions
        <span class="db-badge-count">{{ totalUnreadMentions }}</span>
      </h4>
      <div class="db-widget-list">
        <button
          v-for="m in unreadMentions"
          :key="m.id"
          class="db-widget-item db-widget-item--mention"
          @click="m.channelId != null && emit('goToChannel', m.channelId, m.channelName)"
        >
          <div class="db-widget-avatar" :style="{ background: avatarColor(m.authorName) }">
            {{ m.authorName.slice(0, 2).toUpperCase() }}
          </div>
          <div class="db-widget-body">
            <span class="db-widget-title">{{ m.authorName }}</span>
            <span class="db-widget-sub">#{{ m.channelName }}</span>
          </div>
          <ChevronRight :size="12" class="db-widget-arrow" />
        </button>
      </div>
    </div>

    <!-- Derniers messages de canal -->
    <div v-if="recentChannelActivity.length" class="db-widget">
      <h4 class="db-section-title"><MessageSquare :size="14" /> Activité des canaux</h4>
      <div class="db-widget-list">
        <button
          v-for="n in recentChannelActivity"
          :key="n.id"
          class="db-widget-item"
          @click="n.channelId != null && emit('goToChannel', n.channelId, n.channelName)"
        >
          <div class="db-widget-avatar" :style="{ background: avatarColor(n.authorName) }">
            {{ n.authorName.slice(0, 2).toUpperCase() }}
          </div>
          <div class="db-widget-body">
            <span class="db-widget-title">{{ n.authorName }} <span class="db-widget-channel">#{{ n.channelName }}</span></span>
            <span class="db-widget-time">{{ new Date(n.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
          <span v-if="!n.read" class="db-widget-dot" />
          <ChevronRight :size="12" class="db-widget-arrow" />
        </button>
      </div>
    </div>

    <!-- Prochaines 48h -->
    <div v-if="next48h.length" class="db-widget">
      <h4 class="db-section-title"><CalendarClock :size="14" /> Prochaines 48h</h4>
      <div class="db-widget-list">
        <button
          v-for="item in next48h"
          :key="item.id"
          class="db-widget-item"
          @click="typeof item.id === 'number' ? emit('openGestionDevoir', item.id) : undefined"
        >
          <span class="db-agenda-icon" :class="'db-agenda-' + item.type">
            <Mic v-if="item.type === 'soutenance'" :size="12" />
            <Clock v-else-if="item.type === 'deadline'" :size="12" />
            <CheckCircle2 v-else :size="12" />
          </span>
          <div class="db-widget-body">
            <span class="db-widget-title">{{ item.title }}</span>
            <span class="db-widget-sub">
              {{ new Date(item.time).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) }}
              à {{ new Date(item.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}
              <template v-if="item.room"> · Salle {{ item.room }}</template>
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Brouillons oubliés -->
    <div v-if="forgottenDrafts.length" class="db-widget">
      <h4 class="db-section-title"><EyeOff :size="14" /> Brouillons à publier</h4>
      <div class="db-widget-list">
        <div v-for="t in forgottenDrafts" :key="t.id" class="db-widget-item db-widget-item--draft">
          <span class="db-agenda-icon db-agenda-draft"><FileText :size="12" /></span>
          <div class="db-widget-body">
            <span class="db-widget-title">{{ t.title }}</span>
            <span class="db-widget-sub">
              Deadline {{ deadlineLabel(t.deadline) }}
              <span v-if="new Date(t.deadline).getTime() - Date.now() < 2 * 86_400_000" class="db-draft-urgent">urgent</span>
            </span>
          </div>
          <button class="db-draft-publish" @click.stop="async () => { const ok = await confirm('Publier ce devoir ? Il sera visible par les étudiants.', 'warning', 'Publier'); if (ok) emit('publishDraft', t.id) }">Publier</button>
        </div>
      </div>
    </div>

    <!-- Devoirs sans ressources -->
    <div v-if="devoirsWithoutResources.length" class="db-widget">
      <h4 class="db-section-title"><FileQuestion :size="14" /> Devoirs sans ressources</h4>
      <div class="db-widget-list">
        <button
          v-for="t in devoirsWithoutResources"
          :key="t.id"
          class="db-widget-item"
          @click="emit('openGestionDevoir', t.id)"
        >
          <span class="db-agenda-icon db-agenda-resource"><FileQuestion :size="12" /></span>
          <div class="db-widget-body">
            <span class="db-widget-title">{{ t.title }}</span>
            <span class="db-widget-sub">#{{ t.channel_name }} · Aucune ressource jointe</span>
          </div>
          <ChevronRight :size="12" class="db-widget-arrow" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Section title ── */
.db-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-secondary); margin: 0 0 10px;
}

/* ── DMs non lus ── */
.db-unread-dms, .db-saved-messages { margin: 0; }
.db-badge-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  background: var(--accent); color: #fff;
  border-radius: 9px; font-size: 10.5px; font-weight: 700; margin-left: 6px;
}
.db-unread-list, .db-saved-list { display: flex; flex-direction: column; gap: 3px; }
.db-unread-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-left: 3px solid var(--accent);
  border-radius: 8px; cursor: pointer; transition: all .15s ease;
  width: 100%; text-align: left; font-family: var(--font);
}
.db-unread-item:hover { background: var(--bg-hover); }
.db-unread-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.db-unread-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.db-unread-badge {
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: rgba(74,144,217,.12); padding: 2px 8px; border-radius: 10px;
}
.db-unread-arrow { color: var(--text-muted); flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.db-unread-item:hover .db-unread-arrow { opacity: 1; }

/* ── Messages sauvegardés ── */
.db-saved-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-radius: 8px;
  cursor: pointer; transition: all .15s ease;
}
.db-saved-item:hover { background: var(--bg-hover); }
.db-saved-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0; margin-top: 2px;
}
.db-saved-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.db-saved-author { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
.db-saved-content {
  font-size: 12px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;
}
.db-saved-meta { font-size: 10.5px; color: var(--text-muted); }
.db-saved-remove {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; padding: 4px; border-radius: 4px;
  opacity: 0; transition: all .15s; flex-shrink: 0; margin-top: 2px;
}
.db-saved-item:hover .db-saved-remove { opacity: 1; }
.db-saved-remove:hover { color: var(--color-danger); background: rgba(231,76,60,.1); }
.db-saved-more { font-size: 11.5px; color: var(--text-muted); padding: 4px 0; }

/* ── Grille des widgets (styles inline via gridStyle, responsive via useWidgetGrid) ── */
.db-widgets-grid {
  /* grid-template-columns, grid-auto-rows, grid-auto-flow, gap fournis par gridStyle */
}
.db-widget {
  background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-radius: 10px; padding: 14px;
}
.db-widget-list { display: flex; flex-direction: column; gap: 3px; }
.db-widget-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 7px;
  cursor: pointer; transition: background .12s;
  background: none; border: none; width: 100%;
  text-align: left; font-family: var(--font); color: var(--text-primary);
}
.db-widget-item:hover { background: var(--bg-hover); }
.db-widget-item--mention { border-left: 2px solid var(--accent); }
.db-widget-item--draft { border-left: 2px solid var(--color-warning); }
.db-widget-avatar {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9.5px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.db-widget-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.db-widget-title { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-widget-sub   { font-size: 11px; color: var(--text-muted); }
.db-widget-time  { font-size: 10.5px; color: var(--text-muted); }
.db-widget-channel { font-weight: 400; color: var(--text-muted); font-size: 11px; }
.db-widget-arrow { color: var(--text-muted); flex-shrink: 0; opacity: 0; transition: opacity .12s; }
.db-widget-item:hover .db-widget-arrow { opacity: 1; }
.db-widget-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }

/* ── Agenda icons ── */
.db-agenda-icon {
  width: 26px; height: 26px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.db-agenda-deadline   { background: rgba(74,144,217,.15); color: var(--accent); }
.db-agenda-soutenance { background: rgba(139,92,246,.15); color: #8b5cf6; }
.db-agenda-reminder   { background: rgba(34,197,94,.15); color: #22c55e; }
.db-agenda-draft      { background: rgba(245,158,11,.15); color: #f59e0b; }
.db-agenda-resource   { background: rgba(107,114,128,.15); color: #6b7280; }

.db-draft-publish {
  font-size: 11px; font-weight: 600; font-family: var(--font);
  padding: 3px 10px; border-radius: 5px;
  background: var(--accent); color: #fff;
  border: none; cursor: pointer; flex-shrink: 0; transition: filter .12s;
}
.db-draft-publish:hover { filter: brightness(1.12); }
.db-draft-urgent {
  color: var(--color-danger); font-weight: 700; font-size: 10px;
  text-transform: uppercase; margin-left: 4px;
}
</style>
