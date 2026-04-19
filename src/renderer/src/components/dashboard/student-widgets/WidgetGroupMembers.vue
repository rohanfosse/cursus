<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Users } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { initials, avatarColor } from '@/utils/format'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

interface Member {
  id: number
  name: string
}

const appStore = useAppStore()
const members = ref<Member[]>([])
const groupName = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchGroup() {
  const user = appStore.currentUser
  const promoId = appStore.activePromoId ?? user?.promo_id
  if (!user || !promoId) { members.value = []; return }

  loading.value = true
  error.value = null
  try {
    const groupsRes = await window.api.getGroups(promoId)
    if (!groupsRes.ok || !groupsRes.data) { members.value = []; return }

    // Fetch all group memberships in parallel + students lookup map
    const [allMembers, studentsRes] = await Promise.all([
      Promise.all(groupsRes.data.map(g =>
        window.api.getGroupMembers(g.id).then(res => ({ group: g, res })),
      )),
      window.api.getStudents(promoId),
    ])

    const studentMap = new Map<number, string>()
    if (studentsRes.ok && studentsRes.data) {
      for (const s of studentsRes.data) studentMap.set(s.id, s.name)
    }

    for (const { group, res } of allMembers) {
      if (!res.ok || !res.data) continue
      const memberIds = res.data.map((m) => m.student_id)
      if (!memberIds.includes(user.id)) continue

      groupName.value = group.name
      members.value = memberIds.map(id => ({
        id,
        name: studentMap.get(id) ?? `Étudiant #${id}`,
      }))
      return
    }
    members.value = []
  } catch (err) {
    console.warn('[WidgetGroupMembers] Erreur lors du chargement du groupe', err)
    error.value = 'Erreur de chargement'
    members.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchGroup)
</script>

<template>
  <UiWidgetCard
    :icon="Users"
    label="Mon groupe"
    accent-color="var(--color-group)"
    aria-label="Membres de mon groupe"
  >
    <template v-if="groupName" #header-extra>
      <span class="wgm-name">{{ groupName }}</span>
    </template>

    <div v-if="members.length" class="wgm-list">
      <div v-for="m in members" :key="m.id" class="wgm-member">
        <span class="wgm-avatar" :style="{ background: avatarColor(m.name) }">{{ initials(m.name) }}</span>
        <span class="wgm-mname">{{ m.name }}</span>
      </div>
    </div>
    <div v-else-if="loading" class="wgm-loading">Chargement...</div>
    <EmptyState v-else-if="error" size="sm" tone="danger" :title="error" />
    <EmptyState v-else size="sm" tone="muted" title="Aucun groupe assigné" />
  </UiWidgetCard>
</template>

<style scoped>
.wgm-name {
  font-size: var(--text-xs);
  color: var(--text-muted);
  opacity: .7;
}

.wgm-list { display: flex; flex-direction: column; gap: var(--space-xs); }

.wgm-member {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.wgm-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-2xs);
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.wgm-mname {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wgm-loading {
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-md) 0;
}
</style>
