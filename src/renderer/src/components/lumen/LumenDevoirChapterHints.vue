<script setup lang="ts">
/**
 * Affichage compact des chapitres Lumen lies a un devoir.
 * Reutilisable dans :
 *  - StudentDevoirCard : "Chapitres a revoir" sous la description
 *  - Teacher devoir detail (futur)
 *
 * Fetch autonome sur mount, cache son propre state, se cache si vide.
 * Le titre humain du chapitre est extrait du manifest_json retourne par
 * la route.
 */
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, ChevronRight } from 'lucide-vue-next'
import type { LumenLinkedChapter } from '@/types'

interface Props {
  travailId: number
}
const props = defineProps<Props>()

const router = useRouter()
const chapters = ref<LumenLinkedChapter[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const resp = await window.api.getLumenChaptersForTravail(props.travailId) as {
      ok: boolean
      data?: { chapters: LumenLinkedChapter[] }
    }
    chapters.value = resp?.ok && resp.data ? resp.data.chapters : []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.travailId, load)

interface HintChapter {
  repoId: number
  path: string
  title: string
  projectName: string
}

const hints = computed<HintChapter[]>(() => {
  return chapters.value.map((c) => {
    let title = c.chapter_path
    let projectName = `${c.owner}/${c.repo}`
    if (c.manifest_json) {
      try {
        const m = JSON.parse(c.manifest_json) as {
          project?: string
          chapters?: Array<{ path: string; title: string }>
        }
        const ch = m.chapters?.find((x) => x.path === c.chapter_path)
        if (ch?.title) title = ch.title
        if (m.project) projectName = m.project
      } catch { /* fallback */ }
    }
    return { repoId: c.repo_id, path: c.chapter_path, title, projectName }
  })
})

function openChapter(h: HintChapter) {
  router.push({ name: 'lumen', query: { repo: String(h.repoId), chapter: h.path } })
}
</script>

<template>
  <div v-if="hints.length > 0" class="lumen-hints">
    <header class="lh-head">
      <BookOpen :size="11" />
      <span>Chapitres a revoir</span>
    </header>
    <ul class="lh-list">
      <li v-for="(h, i) in hints" :key="`${h.repoId}::${h.path}`">
        <button type="button" class="lh-item" @click="openChapter(h)">
          <span class="lh-item-title">{{ h.title }}</span>
          <span class="lh-item-project">{{ h.projectName }}</span>
          <ChevronRight :size="11" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lumen-hints {
  margin-top: 10px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  border-radius: 6px;
}
.lh-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 6px;
}
.lh-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lh-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all var(--t-fast, 150ms) ease;
}
.lh-item:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.lh-item-title {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lh-item-project {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
