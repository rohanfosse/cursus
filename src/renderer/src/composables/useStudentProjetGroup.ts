/**
 * useStudentProjetGroup : fetch des membres du groupe (si devoir collectif)
 * pour un projet donne. Se rafraichit a chaque changement de la liste des
 * devoirs (watch immediate cote appelant).
 */
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { Devoir } from '@/types'

export interface GroupMember {
  student_id: number
  student_name: string
  avatar_initials: string
  group_name: string
}

export function useStudentProjetGroup(devoirs: Ref<Devoir[]>) {
  const members = ref<GroupMember[]>([])
  const loading = ref(false)

  const name = computed(() => devoirs.value.find((t) => t.group_name)?.group_name ?? null)

  async function load() {
    const groupDevoir = devoirs.value.find((t) => t.group_id != null)
    if (!groupDevoir) { members.value = []; return }
    loading.value = true
    try {
      const res = await window.api.getTravailGroupMembers(groupDevoir.id)
      members.value = res?.ok ? (res.data as GroupMember[]) : []
    } finally {
      loading.value = false
    }
  }

  watch(devoirs, load, { immediate: true })

  return { name, members, loading, load }
}
