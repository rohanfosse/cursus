<script setup lang="ts">
/**
 * Modal de liaison repo Lumen -> projet (UI fallback teacher).
 * Affiche la liste des repos non encore lies de la promo, avec un
 * filtre recherche et un bouton de liaison. Le projet est identifie
 * par son nom (string legacy Cursus) — le modal resout en interne
 * l'id du projet via la liste des projets de la promo.
 *
 * Protection : si le backend refuse parce que le manifest declare deja
 * un cursusProject, on affiche l'erreur (409 Conflict) sans casser.
 */
import { ref, computed, onMounted } from 'vue'
import { X, Search, AlertTriangle, Link2, Loader2 } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import type { LumenRepo } from '@/types'

interface Props {
  promoId: number
  projectName: string
}
interface Emits {
  (e: 'close'): void
  (e: 'linked', repoId: number): void
}
const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const lumenStore = useLumenStore()
const { showToast } = useToast()

const unlinkedRepos = ref<LumenRepo[]>([])
const loading = ref(false)
const filter = ref('')
const linkingRepoId = ref<number | null>(null)
const projectId = ref<number | null>(null)
const resolveError = ref<string | null>(null)

interface ProjectSummary { id: number; name: string }

async function loadProjects() {
  // Resout le projectId depuis son nom via l'API projets existante
  try {
    const resp = await window.api.getProjectsByPromo(props.promoId) as { ok: boolean; data?: ProjectSummary[] }
    if (!resp?.ok || !resp.data) {
      resolveError.value = 'Impossible de charger les projets de la promo'
      return
    }
    const projects = resp.data
    const normalized = props.projectName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const matches = projects.filter((p) => {
      const n = p.name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return n === normalized
    })
    if (matches.length === 0) {
      resolveError.value = `Projet "${props.projectName}" introuvable dans la promo. Cree-le d'abord.`
    } else if (matches.length > 1) {
      resolveError.value = `Projet "${props.projectName}" ambigu (${matches.length} projets avec ce nom). Renomme l'un d'eux.`
    } else {
      projectId.value = matches[0].id
    }
  } catch (err) {
    resolveError.value = err instanceof Error ? err.message : 'Erreur resolution projet'
  }
}

async function loadUnlinked() {
  loading.value = true
  try {
    unlinkedRepos.value = await lumenStore.fetchUnlinkedReposForPromo(props.promoId)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadProjects(), loadUnlinked()])
})

const filteredRepos = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return unlinkedRepos.value
  return unlinkedRepos.value.filter((r) => {
    const title = (r.manifest?.project ?? r.fullName).toLowerCase()
    return title.includes(q) || r.fullName.toLowerCase().includes(q)
  })
})

async function linkRepo(repo: LumenRepo) {
  if (!projectId.value) return
  // Protection cote UI : refuse si le repo declare deja cursusProject
  if (repo.manifest?.cursusProject) {
    showToast('Ce repo declare deja cursusProject dans son yaml — edite le yaml pour le lier ailleurs', 'error')
    return
  }
  linkingRepoId.value = repo.id
  try {
    const updated = await lumenStore.linkRepoToProject(repo.id, projectId.value)
    if (updated) emit('linked', repo.id)
  } finally {
    linkingRepoId.value = null
  }
}
</script>

<template>
  <div class="llrm-backdrop" @click.self="emit('close')">
    <div class="llrm-modal" role="dialog" aria-labelledby="llrm-title">
      <header class="llrm-head">
        <h3 id="llrm-title">
          <Link2 :size="16" />
          Lier un cours a <span class="llrm-project">{{ projectName }}</span>
        </h3>
        <button type="button" class="llrm-close" @click="emit('close')" aria-label="Fermer">
          <X :size="18" />
        </button>
      </header>

      <div v-if="resolveError" class="llrm-error">
        <AlertTriangle :size="16" />
        <p>{{ resolveError }}</p>
      </div>

      <template v-else>
        <div class="llrm-search">
          <Search :size="14" />
          <input
            v-model="filter"
            type="text"
            placeholder="Filtrer les repos non lies..."
            autofocus
          />
        </div>

        <div v-if="loading" class="llrm-loading">
          <Loader2 :size="16" class="spin" /> Chargement...
        </div>
        <p v-else-if="unlinkedRepos.length === 0" class="llrm-empty">
          Tous les repos de la promo sont deja lies a un projet.
        </p>
        <p v-else-if="filteredRepos.length === 0" class="llrm-empty">
          Aucun repo ne correspond au filtre.
        </p>
        <ul v-else class="llrm-repo-list">
          <li v-for="repo in filteredRepos" :key="repo.id">
            <div class="llrm-repo">
              <div class="llrm-repo-info">
                <span class="llrm-repo-title">{{ repo.manifest?.project ?? repo.fullName }}</span>
                <span class="llrm-repo-sub">{{ repo.fullName }}</span>
                <span v-if="repo.manifest?.cursusProject" class="llrm-repo-warn">
                  Declare deja cursusProject: "{{ repo.manifest.cursusProject }}" (non-liable via UI)
                </span>
                <span v-else-if="repo.manifestError" class="llrm-repo-warn">
                  Manifest : {{ repo.manifestError }}
                </span>
              </div>
              <button
                type="button"
                class="llrm-repo-link"
                :disabled="!!repo.manifest?.cursusProject || linkingRepoId === repo.id || !projectId"
                @click="linkRepo(repo)"
              >
                <Loader2 v-if="linkingRepoId === repo.id" :size="12" class="spin" />
                Lier
              </button>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
.llrm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fade-in 150ms ease-out;
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

.llrm-modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  width: min(560px, calc(100% - 32px));
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slide-up 200ms ease-out;
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.llrm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.llrm-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.llrm-project { color: var(--accent); }
.llrm-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  border-radius: 4px;
}
.llrm-close:hover { color: var(--text-primary); background: var(--bg-hover); }

.llrm-error {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  color: var(--warning, #d98a00);
  font-size: 13px;
}
.llrm-error p { margin: 0; }

.llrm-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  margin: 12px 16px 0;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
}
.llrm-search:focus-within {
  border-color: var(--accent);
  color: var(--text-primary);
}
.llrm-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
}

.llrm-loading, .llrm-empty {
  padding: 24px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
}

.llrm-repo-list {
  list-style: none;
  margin: 12px 0;
  padding: 0 16px 16px;
  overflow-y: auto;
  flex: 1;
}
.llrm-repo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 6px;
}
.llrm-repo-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.llrm-repo-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.llrm-repo-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
.llrm-repo-warn {
  font-size: 10.5px;
  color: var(--warning, #d98a00);
  margin-top: 2px;
}

.llrm-repo-link {
  padding: 6px 14px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.llrm-repo-link:hover:not(:disabled) { opacity: 0.9; }
.llrm-repo-link:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
