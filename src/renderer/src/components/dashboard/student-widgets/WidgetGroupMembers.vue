/**
 * WidgetGroupMembers.vue - Membres du groupe de l'étudiant pour le projet actif.
 */
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Users } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'

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
    // 1. Fetch all groups for the promo
    const groupsRes = await window.api.getGroups(promoId)
    if (!groupsRes.ok || !groupsRes.data) { members.value = []; return }

    // 2. Find the group containing the current user
    for (const group of groupsRes.data) {
      const membersRes = await window.api.getGroupMembers(group.id)
      if (!membersRes.ok || !membersRes.data) continue
      const memberIds = membersRes.data.map((m) => m.student_id)
      if (!memberIds.includes(user.id)) continue

      groupName.value = group.name

      // 3. Resolve names via getStudents (promo-scoped, accessible aux etudiants)
      const studentsRes = await window.api.getStudents(promoId)
      const studentMap = new Map<number, string>()
      if (studentsRes.ok && studentsRes.data) {
        for (const s of studentsRes.data) studentMap.set(s.id, s.name)
      }

      members.value = memberIds.map(id => ({
        id,
        name: studentMap.get(id) ?? `Etudiant #${id}`,
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

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

const avatarColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function avatarColor(index: number): string {
  return avatarColors[index % avatarColors.length]
}

onMounted(fetchGroup)
</script>

<template>
  <div class="dashboard-card sa-card sa-group" aria-label="Membres de mon groupe">
    <div class="sa-card-header">
      <Users :size="14" class="sa-card-icon sa-icon--group" />
      <span class="sa-section-label">Mon groupe</span>
      <span v-if="groupName" class="sa-group-name">{{ groupName }}</span>
    </div>
    <div v-if="members.length" class="sa-group-list">
      <div v-for="(m, i) in members" :key="m.id" class="sa-group-member">
        <span class="sa-member-avatar" :style="{ background: avatarColor(i) }">{{ initials(m.name) }}</span>
        <span class="sa-member-name">{{ m.name }}</span>
      </div>
    </div>
    <p v-else-if="loading" class="sa-empty">Chargement...</p>
    <p v-else-if="error" class="sa-empty sa-empty--error">{{ error }}</p>
    <p v-else class="sa-empty">Aucun groupe assigne</p>
  </div>
</template>

<style scoped>
.sa-group { border-left: 3px solid var(--color-group, #14b8a6); }
.sa-icon--group { color: var(--color-group, #14b8a6); }

.sa-group-name {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  opacity: .7;
}

.sa-group-list { display: flex; flex-direction: column; gap: 6px; }

.sa-group-member {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.sa-member-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.sa-member-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* .sa-empty and .sa-empty--error in devoirs-shared.css */
</style>
