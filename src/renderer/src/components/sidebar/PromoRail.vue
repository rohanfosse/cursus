<script setup lang="ts">
  import { useAppStore } from '@/stores/app'
  import type { Promotion } from '@/types'

  interface Props {
    promotions: Promotion[]
  }

  const props    = defineProps<Props>()
  const emit     = defineEmits<{ select: [promoId: number] }>()
  const appStore = useAppStore()
</script>

<template>
  <ul id="nav-promo-list" class="nav-promo-list" aria-label="Promotions">
    <li v-for="p in props.promotions" :key="p.id">
      <button
        class="nav-promo-btn"
        :class="{ active: appStore.activePromoId === p.id }"
        :title="p.name"
        :style="{ '--promo-color': p.color }"
        @click="emit('select', p.id)"
      >
        {{ p.name }}
      </button>
    </li>
  </ul>
</template>
