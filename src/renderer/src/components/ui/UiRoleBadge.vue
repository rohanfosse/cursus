<script setup lang="ts">
/**
 * Pill sémantique "rôle" : affichage compact d'un attribut utilisateur
 * (Enseignant, TA, Admin...) harmonisé à travers toute l'application.
 *
 * Usage :
 *   <UiRoleBadge role="teacher" />
 *   <UiRoleBadge role="ta" size="sm" />
 *   <UiRoleBadge role="admin" :icon="false" />
 *
 * Remplace les patterns dupliqués :
 *   - `.msg-role-badge` (chat MessageBubble)
 *   - `.dm-teacher-tag` (sidebar DM list)
 *   - `.mi-badge-teacher` / `.mi-badge-ta` (MessageInput autocomplete)
 */
import { computed } from 'vue'
import { GraduationCap, Users, Shield } from 'lucide-vue-next'

type UserRole = 'teacher' | 'ta' | 'admin'

interface Props {
  role: UserRole
  size?: 'xs' | 'sm'
  /** Masquer l'icône (text-only badge). Défaut: affichée. */
  icon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  icon: true,
})

const ROLE_LABEL: Record<UserRole, string> = {
  teacher: 'Enseignant',
  ta: 'Intervenant',
  admin: 'Admin',
}

const ROLE_ICON = {
  teacher: GraduationCap,
  ta: Users,
  admin: Shield,
} as const

const label = computed(() => ROLE_LABEL[props.role])
const IconComponent = computed(() => ROLE_ICON[props.role])
const iconSize = computed(() => props.size === 'xs' ? 8 : 9)
</script>

<template>
  <span class="u-role-badge" :class="[`u-role-badge--${role}`, `u-role-badge--${size}`]" :title="label">
    <component :is="IconComponent" v-if="icon" :size="iconSize" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.u-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  border-radius: 999px;
  line-height: 1;
  white-space: nowrap;
}

.u-role-badge--xs {
  font-size: 9px;
  padding: 1px 5px;
}
.u-role-badge--sm {
  font-size: 9.5px;
  padding: 2px 7px;
}

/* Rôles — couleurs dérivées des tokens sémantiques */
.u-role-badge--teacher {
  color: var(--accent);
  background: var(--accent-subtle);
}
.u-role-badge--ta {
  color: var(--color-cctl);
  background: color-mix(in srgb, var(--color-cctl) 16%, transparent);
}
.u-role-badge--admin {
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 16%, transparent);
}

.u-role-badge svg { opacity: .85; flex-shrink: 0; }
</style>
