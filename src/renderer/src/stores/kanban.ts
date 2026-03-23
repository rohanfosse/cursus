/** Store Kanban — suivi de tâches par groupe de projet. */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import type { KanbanCard } from '@/types'

export const useKanbanStore = defineStore('kanban', () => {
  const { api } = useApi()

  const cards   = ref<KanbanCard[]>([])
  const loading = ref(false)

  async function fetchCards(travailId: number, groupId: number): Promise<void> {
    loading.value = true
    try {
      const data = await api<KanbanCard[]>(
        () => window.api.getKanbanCards(travailId, groupId),
      )
      if (data) cards.value = data
    } finally {
      loading.value = false
    }
  }

  async function createCard(travailId: number, groupId: number, payload: { title: string; description?: string }): Promise<KanbanCard | null> {
    const data = await api<KanbanCard>(
      () => window.api.createKanbanCard(travailId, groupId, payload),
    )
    if (data) cards.value = [...cards.value, data]
    return data ?? null
  }

  async function moveCard(cardId: number, status: KanbanCard['status'], position: number): Promise<boolean> {
    const data = await api<KanbanCard>(
      () => window.api.updateKanbanCard(cardId, { status, position }),
    )
    if (data) {
      cards.value = cards.value.map(c => c.id === cardId ? data : c)
      return true
    }
    return false
  }

  async function updateCard(cardId: number, payload: { title?: string; description?: string }): Promise<boolean> {
    const data = await api<KanbanCard>(
      () => window.api.updateKanbanCard(cardId, payload),
    )
    if (data) {
      cards.value = cards.value.map(c => c.id === cardId ? data : c)
      return true
    }
    return false
  }

  async function deleteCard(cardId: number): Promise<boolean> {
    const data = await api(
      () => window.api.deleteKanbanCard(cardId),
    )
    if (data !== null) {
      cards.value = cards.value.filter(c => c.id !== cardId)
      return true
    }
    return false
  }

  return { cards, loading, fetchCards, createCard, moveCard, updateCard, deleteCard }
})
