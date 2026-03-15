<script setup lang="ts">
  interface Props {
    initials: string
    color: string
    size?: number
    photoData?: string | null
  }

  const props = withDefaults(defineProps<Props>(), { size: 34, photoData: null })
</script>

<template>
  <div
    class="msg-avatar"
    :style="{
      width: `${props.size}px`,
      height: `${props.size}px`,
      fontSize: `${Math.round(props.size * 0.33)}px`,
      flexShrink: 0,
      borderRadius: '50%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: props.photoData ? 'transparent' : props.color,
      color: '#fff',
    }"
  >
    <img
      v-if="props.photoData"
      :src="props.photoData"
      :alt="props.initials"
      style="width: 100%; height: 100%; object-fit: cover"
    />
    <span v-else>{{ props.initials }}</span>
  </div>
</template>
