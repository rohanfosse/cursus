<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BookOpen, Play } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useLumenStore } from '@/stores/lumen'
import { useAppStore } from '@/stores/app'
import { useLumenLastChapter } from '@/composables/useLumenLastChapter'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const lumenStore = useLumenStore()
const appStore = useAppStore()
const lastChapter = useLumenLastChapter()

const loading = ref(true)

onMounted(async () => {
  const pid = appStore.activePromoId
  if (pid) {
    await lumenStore.fetchReposForPromo(pid)
  }
  loading.value = false
})

const resumeInfo = computed(() => {
  const pid = appStore.activePromoId
  if (!pid) return null
  const last = lastChapter.get(pid)
  if (!last) return null
  const repo = lumenStore.repos.find((r) => r.id === last.repoId)
  if (!repo) return null
  const chapter = repo.manifest?.chapters.find((c) => c.path === last.chapterPath)
  if (!chapter) return null
  return {
    repoName: repo.manifest?.project ?? repo.fullName,
    chapterTitle: chapter.title,
    repoId: repo.id,
    chapterPath: last.chapterPath,
  }
})

function openLumen() {
  const r = resumeInfo.value
  if (r) {
    router.push({ name: 'lumen', query: { repo: String(r.repoId), chapter: r.chapterPath } })
  } else {
    router.push('/lumen')
  }
}
</script>

<template>
  <UiWidgetCard :icon="BookOpen" label="Continuer la lecture">
    <div v-if="loading" class="wlp-loading">
      <span>Chargement...</span>
    </div>

    <button v-else-if="resumeInfo" type="button" class="wlp-resume" @click="openLumen">
      <span class="wlp-resume-icon">
        <Play :size="14" />
      </span>
      <span class="wlp-resume-text">
        <span class="wlp-resume-repo">{{ resumeInfo.repoName }}</span>
        <span class="wlp-resume-chapter">{{ resumeInfo.chapterTitle }}</span>
      </span>
    </button>

    <EmptyState v-else size="sm" tone="muted" title="Aucun cours ouvert récemment">
      <button type="button" class="wlp-open-btn" @click="openLumen">
        Ouvrir Lumen
      </button>
    </EmptyState>
  </UiWidgetCard>
</template>

<style scoped>
.wlp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
  padding: var(--space-md) 0;
}

.wlp-resume {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out);
}
.wlp-resume:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}
.wlp-resume:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wlp-resume-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--accent);
  color: #fff;
  flex-shrink: 0;
}

.wlp-resume-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wlp-resume-repo {
  font-size: var(--text-2xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wlp-resume-chapter {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wlp-open-btn {
  padding: 6px var(--space-md);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  transition: opacity var(--motion-fast) var(--ease-out);
}
.wlp-open-btn:hover { opacity: 0.9; }
.wlp-open-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
