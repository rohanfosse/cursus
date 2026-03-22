/**
 * Panneau latéral droit : devoirs/travaux liés au canal actif.
 * Même format que ChannelMembersPanel et ChannelDocsPanel.
 */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, BookOpen, Clock, CheckCircle2, FileText, Mic, Award } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { deadlineClass, deadlineLabel } from '@/utils/date'
import { typeLabel } from '@/utils/devoir'

const emit = defineEmits<{ close: [] }>()

const appStore = useAppStore()
const modals   = useModalsStore()

interface Travail {
  id: number; title: string; type: string; deadline: string
  is_published: number; depots_count: number; students_total: number
  category?: string | null
}

const travaux = ref<Travail[]>([])
const loading = ref(true)

async function load() {
  if (!appStore.activeChannelId) return
  loading.value = true
  try {
    const res = await window.api.getTravaux(appStore.activeChannelId)
    travaux.value = res?.ok ? (res.data as unknown as Travail[]) : []
  } finally {
    loading.value = false
  }
}

watch(() => appStore.activeChannelId, load, { immediate: true })

function openDevoir(id: number) {
  appStore.currentTravailId = id
  modals.gestionDevoir = true
}

const TYPE_ICONS: Record<string, object> = {
  livrable: FileText, soutenance: Mic, cctl: Award, etude_de_cas: BookOpen,
  memoire: FileText, autre: FileText,
}
</script>

<template>
  <div class="side-panel">
    <div class="side-panel-header">
      <BookOpen :size="15" />
      <span class="side-panel-title">Travaux</span>
      <span class="side-panel-count">{{ travaux.length }}</span>
      <button class="side-panel-close" @click="emit('close')"><X :size="16" /></button>
    </div>

    <div class="side-panel-body">
      <!-- Loading -->
      <div v-if="loading" class="sp-loading">
        <div v-for="i in 4" :key="i" class="skel skel-line" style="height:48px;border-radius:8px;margin-bottom:8px" />
      </div>

      <!-- Empty -->
      <div v-else-if="!travaux.length" class="sp-empty">
        <BookOpen :size="28" style="opacity:.2;margin-bottom:8px" />
        <p>Aucun devoir lié à ce canal.</p>
      </div>

      <!-- List -->
      <div v-else class="sp-list">
        <button
          v-for="t in travaux" :key="t.id"
          class="sp-travail-item"
          @click="openDevoir(t.id)"
        >
          <span class="sp-travail-icon" :class="`sp-type-${t.type}`">
            <component :is="TYPE_ICONS[t.type] ?? FileText" :size="13" />
          </span>
          <div class="sp-travail-body">
            <span class="sp-travail-title">{{ t.title }}</span>
            <span class="sp-travail-meta">
              <span class="sp-travail-type">{{ typeLabel(t.type) }}</span>
              <span class="sp-travail-deadline" :class="deadlineClass(t.deadline)">
                <Clock :size="10" /> {{ deadlineLabel(t.deadline) }}
              </span>
            </span>
          </div>
          <span v-if="t.depots_count > 0 && t.students_total > 0" class="sp-travail-progress">
            {{ t.depots_count }}/{{ t.students_total }}
          </span>
          <CheckCircle2 v-else-if="!t.is_published" :size="12" style="opacity:.3" title="Brouillon" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.side-panel {
  width: 300px; min-width: 300px; max-width: 300px;
  height: 100%; display: flex; flex-direction: column;
  background: var(--bg-sidebar); border-left: 1px solid var(--border);
}
.side-panel-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px; border-bottom: 1px solid var(--border);
  font-size: 14px; font-weight: 700; color: var(--text-primary);
}
.side-panel-title { flex: 1; }
.side-panel-count {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.06); padding: 1px 7px; border-radius: 10px;
}
.side-panel-close {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; padding: 4px; border-radius: 6px;
  transition: all .12s;
}
.side-panel-close:hover { background: rgba(255,255,255,.08); color: var(--text-primary); }

.side-panel-body { flex: 1; overflow-y: auto; padding: 12px; }

.sp-loading { padding: 4px; }
.sp-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 40px 16px; text-align: center;
  color: var(--text-muted); font-size: 13px;
}

.sp-list { display: flex; flex-direction: column; gap: 4px; }
.sp-travail-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  background: transparent; border: none; font-family: var(--font);
  color: var(--text-primary); text-align: left; width: 100%;
  transition: background .12s;
}
.sp-travail-item:hover { background: rgba(255,255,255,.05); }

.sp-travail-icon {
  width: 28px; height: 28px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.sp-type-livrable     { background: rgba(74,144,217,.12); color: var(--accent); }
.sp-type-soutenance   { background: rgba(243,156,18,.12); color: var(--color-warning); }
.sp-type-cctl         { background: rgba(155,135,245,.12); color: var(--color-cctl); }
.sp-type-etude_de_cas { background: rgba(46,204,113,.12); color: var(--color-success); }
.sp-type-memoire      { background: rgba(231,76,60,.12); color: var(--color-danger); }
.sp-type-autre        { background: rgba(127,140,141,.12); color: var(--color-autre); }

.sp-travail-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sp-travail-title {
  font-size: 13px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sp-travail-meta { display: flex; align-items: center; gap: 8px; }
.sp-travail-type { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
.sp-travail-deadline {
  font-size: 10px; display: flex; align-items: center; gap: 3px;
}
.sp-travail-progress {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.06); padding: 2px 6px; border-radius: 6px;
}
</style>
