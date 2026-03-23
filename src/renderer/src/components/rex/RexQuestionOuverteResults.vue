/** RexQuestionOuverteResults — Liste de reponses anonymes avec epinglage. */
<script setup lang="ts">
  import { computed } from 'vue'
  import { Pin } from 'lucide-vue-next'
  import { relativeTime } from '@/utils/date'

  const props = defineProps<{
    answers: { id: number; answer: string; pinned: boolean; created_at: string }[]
    isTeacher: boolean
  }>()

  const emit = defineEmits<{
    togglePin: [responseId: number, pinned: boolean]
  }>()

  const sorted = computed(() =>
    [...props.answers].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }),
  )

  // relativeTime imported from @/utils/date
</script>

<template>
  <div class="rex-qo">
    <div class="rex-qo-list">
      <div
        v-for="a in sorted"
        :key="a.id"
        class="rex-qo-card"
        :class="{ pinned: a.pinned }"
      >
        <p class="rex-qo-text">{{ a.answer }}</p>
        <div class="rex-qo-meta">
          <span class="rex-qo-time">{{ relativeTime(a.created_at) }}</span>
          <button
            v-if="isTeacher"
            class="rex-qo-pin"
            :class="{ active: a.pinned }"
            title="Epingler"
            @click="emit('togglePin', a.id, !a.pinned)"
          >
            <Pin :size="14" />
          </button>
        </div>
      </div>
      <p v-if="!answers.length" class="rex-qo-empty">Aucune reponse pour le moment</p>
    </div>
  </div>
</template>

<style scoped>
.rex-qo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}
.rex-qo-card {
  padding: 12px 14px;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
  border-radius: 10px;
  transition: all 0.4s ease;
}
.rex-qo-card.pinned {
  border-left: 3px solid #0d9488;
  background: rgba(13, 148, 136, 0.06);
}
.rex-qo-text {
  font-size: 14px;
  color: var(--text-primary, #fff);
  line-height: 1.5;
  margin: 0;
}
.rex-qo-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.rex-qo-time {
  font-size: 11px;
  color: var(--text-muted, #888);
}
.rex-qo-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted, #888);
  cursor: pointer;
  transition: all 0.4s ease;
}
.rex-qo-pin:hover {
  background: rgba(13, 148, 136, 0.12);
  color: #14b8a6;
}
.rex-qo-pin.active {
  color: #0d9488;
}
.rex-qo-empty {
  text-align: center;
  color: var(--text-muted, #888);
  font-size: 13px;
  padding: 20px 0;
}
</style>
