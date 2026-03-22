/**
 * TeacherHeader.vue
 * ---------------------------------------------------------------------------
 * Compact header: greeting + date on the left, promo chips on the right.
 * Stats are displayed in the Bento TabAccueil tiles instead.
 */
<script setup lang="ts">
import { Menu } from 'lucide-vue-next'
import type { Promotion } from '@/types'

defineProps<{
  toggleSidebar?: () => void
  greetingName: string
  today: string
  promos: Promotion[]
  activePromoId: number | null
}>()

const emit = defineEmits<{
  'update:activePromoId': [id: number]
}>()
</script>

<template>
  <div class="db-header">
    <div class="db-header-left">
      <button v-if="toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="toggleSidebar">
        <Menu :size="22" />
      </button>
      <div>
        <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
        <p class="db-date">{{ today }}</p>
      </div>
    </div>
    <div class="db-header-promos">
      <button
        v-for="p in promos"
        :key="p.id"
        class="db-promo-chip"
        :class="{ active: activePromoId === p.id }"
        :style="activePromoId === p.id ? { background: 'color-mix(in srgb, ' + p.color + ' 20%, transparent)', color: p.color, borderColor: p.color } : {}"
        :aria-label="`Sélectionner la promotion ${p.name}`"
        @click="emit('update:activePromoId', p.id)"
      >
        <span class="db-promo-chip-dot" :style="{ background: p.color }" />
        {{ p.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Header base (.db-header, .db-header-left, .db-title, .db-date): see dashboard-shared.css */

.db-header-promos { display: flex; gap: 6px; flex-wrap: wrap; }
.db-promo-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 600;
  background: rgba(255,255,255,.04); color: var(--text-secondary);
  border: 1.5px solid rgba(255,255,255,.08); cursor: pointer;
  font-family: var(--font); transition: all .15s;
}
.db-promo-chip:hover { background: rgba(255,255,255,.08); }
.db-promo-chip.active { font-weight: 700; }
.db-promo-chip-dot { width: 7px; height: 7px; border-radius: 50%; }
</style>
