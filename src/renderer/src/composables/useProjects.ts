/**
 * Composable CRUD pour les projets (entite backend).
 * Utilise les endpoints exposes via window.api.
 */
import { ref, type Ref } from 'vue'
import { useApi } from './useApi'
import { useAppStore } from '@/stores/app'

export interface Project {
  id: number
  promo_id: number
  name: string
  description: string | null
  deadline: string | null
  created_by: number
  created_at: string
  updated_at: string
}

export interface CreateProjectPayload {
  promoId: number
  name: string
  description?: string
  deadline?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCall = () => Promise<any>

export function useProjects() {
  const { api } = useApi()
  const appStore = useAppStore()

  const projects: Ref<Project[]> = ref([])
  const loading = ref(false)

  async function loadProjects(promoId?: number): Promise<void> {
    const pid = promoId ?? appStore.activePromoId
    if (!pid) return
    loading.value = true
    try {
      const data = await api<Project[]>(
        (() => window.api.getProjectsByPromo(pid)) as AnyCall,
        'promo',
      )
      projects.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function loadTaProjects(): Promise<void> {
    if (!appStore.currentUser) return
    const teacherId = Math.abs(appStore.currentUser.id)
    loading.value = true
    try {
      const data = await api<Project[]>(
        (() => window.api.getTaProjects(teacherId)) as AnyCall,
      )
      projects.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function createProject(payload: CreateProjectPayload): Promise<Project | null> {
    if (!appStore.currentUser) return null
    const createdBy = Math.abs(appStore.currentUser.id)
    const data = await api<Project>(
      (() => window.api.createProject({ ...payload, createdBy })) as AnyCall,
    )
    if (data) await loadProjects(payload.promoId)
    return data
  }

  async function updateProject(id: number, payload: Partial<Pick<Project, 'name' | 'description' | 'deadline'>>): Promise<Project | null> {
    const data = await api<Project>(
      (() => window.api.updateProject(id, payload)) as AnyCall,
    )
    if (data) await loadProjects()
    return data
  }

  async function deleteProject(id: number): Promise<boolean> {
    const data = await api<unknown>(
      (() => window.api.deleteProject(id)) as AnyCall,
    )
    if (data !== null) await loadProjects()
    return data !== null
  }

  async function assignTa(teacherId: number, projectId: number): Promise<boolean> {
    const data = await api<unknown>(
      (() => window.api.assignTaToProject(teacherId, projectId)) as AnyCall,
    )
    return data !== null
  }

  async function unassignTa(teacherId: number, projectId: number): Promise<boolean> {
    const data = await api<unknown>(
      (() => window.api.unassignTaFromProject(teacherId, projectId)) as AnyCall,
    )
    return data !== null
  }

  async function getProjectTas(projectId: number) {
    return await api<unknown[]>(
      (() => window.api.getProjectTas(projectId)) as AnyCall,
    )
  }

  return {
    projects,
    loading,
    loadProjects,
    loadTaProjects,
    createProject,
    updateProject,
    deleteProject,
    assignTa,
    unassignTa,
    getProjectTas,
  }
}
