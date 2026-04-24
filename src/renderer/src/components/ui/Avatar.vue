<script setup lang="ts">
  import { computed, type Component } from 'vue'
  import { useStatusesStore } from '@/stores/statuses'

  interface Props {
    initials:  string
    color:     string
    size?:     number
    photoData?: string | null
    /** Composant Lucide a afficher a la place des initiales */
    icon?:     Component | null
    /** Si fourni, affiche un badge emoji de statut en bas a droite */
    userId?:   number | null
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 34, photoData: null, icon: null, userId: null,
  })

  const statuses = useStatusesStore()
  const status = computed(() => props.userId != null ? statuses.get(props.userId) : null)
  const badgeSize = computed(() => Math.max(14, Math.round(props.size * 0.42)))
</script>

<template>
  <div class="avatar-wrap" :style="{ width: `${props.size}px`, height: `${props.size}px` }">
    <div
      class="msg-avatar"
      :style="{
        width:           `${props.size}px`,
        height:          `${props.size}px`,
        fontSize:        `${Math.round(props.size * 0.33)}px`,
        flexShrink:      0,
        borderRadius:    '8px',
        overflow:        'hidden',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      props.photoData ? 'transparent' : props.color,
        color:           '#fff',
        fontWeight:      '700',
        letterSpacing:   '-0.3px',
      }"
    >
      <img
        v-if="props.photoData"
        :src="props.photoData"
        :alt="props.initials"
        style="width: 100%; height: 100%; object-fit: cover"
      />
      <component
        :is="props.icon"
        v-else-if="props.icon"
        :size="Math.round(props.size * 0.52)"
      />
      <span v-else>{{ props.initials }}</span>
    </div>

    <span
      v-if="status?.emoji"
      class="avatar-status-badge"
      :style="{
        width: `${badgeSize}px`,
        height: `${badgeSize}px`,
        fontSize: `${Math.round(badgeSize * 0.75)}px`,
      }"
      :title="status.text || status.emoji"
    >{{ status.emoji }}</span>
  </div>
</template>

<style scoped>
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
  display: inline-block;
}
.avatar-status-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: var(--bg-surface, #2a2a2a);
  border: 2px solid var(--bg-primary, #1a1a1a);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
</style>
