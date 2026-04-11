<script setup lang="ts">
/**
 * Section "Cours Lumen" integree dans une vue projet Cursus.
 * Reutilise des deux cotes :
 *  - StudentProjetFiche.vue (read-only, cachee si 0 repos)
 *  - TeacherProjectDetail.vue (cachee pour 0 repos mais avec CTA "Lier")
 *
 * Props :
 *  - promoId : id de la promo du projet (pour scope)
 *  - projectName : nom string du projet (Cursus utilise name-as-key legacy)
 *  - isTeacher : true = affiche empty state avec CTA, false = cache si 0 repos
 *
 * Comportement :
 *  - Fetch les repos lies au mount et au changement de projet
 *  - Liste chaque repo avec ses chapitres cliquables (deep-link /lumen)
 *  - CTA teacher ouvre un modal de liaison (LumenLinkRepoModal)
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, FileText, Link2, AlertTriangle, Plus } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import type { LumenRepo } from '@/types'
import LumenLinkRepoModal from '@/components/lumen/LumenLinkRepoModal.vue'

interface Props {
  promoId: number
  projectName: string
  isTeacher: boolean
}
const props = defineProps<Props>()

const router = useRouter()
const lumenStore = useLumenStore()
const { showToast } = useToast()

const linkedRepos = ref<LumenRepo[]>([])
const loading = ref(false)
const linkModalOpen = ref(false)

async function loadRepos() {
  if (!props.promoId || !props.projectName) return
  loading.value = true
  try {
    linkedRepos.value = await lumenStore.fetchReposByProjectName(props.promoId, props.projectName)
  } finally {
    loading.value = false
  }
}

onMounted(loadRepos)
watch(() => [props.promoId, props.projectName], loadRepos)

/** Caches entierement pour students quand 0 repos. */
const shouldRender = computed(() => {
  if (loading.value) return props.isTeacher
  return props.isTeacher || linkedRepos.value.length > 0
})

function openChapter(repo: LumenRepo, chapterPath: string) {
  router.push({
    name: 'lumen',
    query: { repo: String(repo.id), chapter: chapterPath },
  })
}

function openFirstChapter(repo: LumenRepo) {
  const first = repo.manifest?.chapters?.[0]
  if (!first) return
  openChapter(repo, first.path)
}

async function handleLinked(repoId: number) {
  // Modal emet un event apres liaison reussie : on refresh la liste
  linkModalOpen.value = false
  showToast('Cours lie au projet', 'success')
  await loadRepos()
}
</script>

<template>
  <section v-if="shouldRender" class="lumen-project-section">
    <header class="lps-head">
      <div class="lps-title">
        <BookOpen :size="14" />
        <span>Cours Lumen</span>
        <span v-if="linkedRepos.length" class="lps-count">{{ linkedRepos.length }}</span>
      </div>
      <button
        v-if="isTeacher"
        type="button"
        class="lps-link-btn"
        :title="linkedRepos.length ? 'Lier un autre cours a ce projet' : 'Lier un cours Lumen a ce projet'"
        @click="linkModalOpen = true"
      >
        <Plus :size="12" />
        Lier un cours
      </button>
    </header>

    <div v-if="loading" class="lps-loading">Chargement...</div>

    <div v-else-if="linkedRepos.length === 0" class="lps-empty">
      <Link2 :size="24" />
      <p>Aucun cours lie a ce projet pour l'instant.</p>
      <p class="lps-empty-hint">
        Ajoute <code>cursusProject: "{{ projectName }}"</code> dans le <code>cursus.yaml</code>
        du repo, ou clique sur "Lier un cours" pour l'associer manuellement.
      </p>
    </div>

    <ul v-else class="lps-repo-list">
      <li v-for="repo in linkedRepos" :key="repo.id" class="lps-repo">
        <header class="lps-repo-head">
          <button
            type="button"
            class="lps-repo-title"
            :title="`Ouvrir ${repo.manifest?.project ?? repo.fullName} dans Lumen`"
            @click="openFirstChapter(repo)"
          >
            <span>{{ repo.manifest?.project ?? repo.fullName }}</span>
            <span v-if="repo.manifest?.module" class="lps-repo-module">— {{ repo.manifest.module }}</span>
          </button>
          <span v-if="repo.manifestError" class="lps-repo-err" :title="repo.manifestError">
            <AlertTriangle :size="12" />
          </span>
        </header>
        <ol v-if="repo.manifest?.chapters?.length" class="lps-chapter-list">
          <li v-for="(ch, i) in repo.manifest.chapters" :key="ch.path">
            <button type="button" class="lps-chapter" @click="openChapter(repo, ch.path)">
              <span class="lps-chapter-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <FileText :size="12" />
              <span class="lps-chapter-title">{{ ch.title }}</span>
              <span v-if="ch.duration" class="lps-chapter-duration">{{ ch.duration }} min</span>
            </button>
          </li>
        </ol>
      </li>
    </ul>

    <LumenLinkRepoModal
      v-if="linkModalOpen"
      :promo-id="promoId"
      :project-name="projectName"
      @close="linkModalOpen = false"
      @linked="handleLinked"
    />
  </section>
</template>

<style scoped>
.lumen-project-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin: 12px 0;
}

.lps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lps-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.lps-count {
  background: var(--bg-primary);
  color: var(--text-muted);
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.lps-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.lps-link-btn:hover { opacity: 0.9; }

.lps-loading {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 0;
  text-align: center;
}

.lps-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: var(--text-muted);
  text-align: center;
}
.lps-empty p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  max-width: 420px;
}
.lps-empty-hint {
  font-size: 11px;
  opacity: 0.8;
}
.lps-empty code {
  background: var(--bg-primary);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.lps-repo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lps-repo {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.lps-repo-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.lps-repo-title {
  flex: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  text-align: left;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lps-repo-title:hover { color: var(--accent); }
.lps-repo-module {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 12px;
}
.lps-repo-err { color: var(--warning, #d98a00); flex-shrink: 0; }

.lps-chapter-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}
.lps-chapter {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px 6px 16px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  transition: all var(--t-fast, 150ms) ease;
  border-left: 2px solid transparent;
}
.lps-chapter:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-left-color: var(--accent);
}
.lps-chapter-num {
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
  flex-shrink: 0;
  width: 20px;
}
.lps-chapter-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lps-chapter-duration {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
