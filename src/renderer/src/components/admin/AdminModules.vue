<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Kanban, Calendar, Zap, PenTool, BookOpen, Gamepad2, type LucideIcon } from 'lucide-vue-next'
import { useModules, type ModuleName } from '@/composables/useModules'
import { useToast } from '@/composables/useToast'

const { modules, MODULES, MODULE_LABELS, setEnabled, loadModules } = useModules()
const { showToast } = useToast()

interface ModuleMeta {
  id: ModuleName
  icon: LucideIcon
  description: string
}

const MODULE_META: Record<ModuleName, ModuleMeta> = {
  kanban:     { id: 'kanban',     icon: Kanban,    description: 'Tableau kanban par projet et par groupe.' },
  frise:      { id: 'frise',      icon: Calendar,  description: 'Frise chronologique de projet (phases, jalons).' },
  live:       { id: 'live',       icon: Zap,       description: 'Sessions Live (quiz Spark, feedback Pulse, code, tableau).' },
  signatures: { id: 'signatures', icon: PenTool,   description: 'Signature electronique de documents PDF.' },
  lumen:      { id: 'lumen',      icon: BookOpen,  description: 'Liseuse de cours adossee a des repositories GitHub.' },
  games:      { id: 'games',      icon: Gamepad2,  description: 'Jeux (TypeRace, Snake, Space Invaders). Opt-in etudiants, toujours visible pour les profs.' },
}

const saving = ref<ModuleName | null>(null)

onMounted(async () => {
  await loadModules()
})

async function toggle(module: ModuleName) {
  const next = !modules.value[module]
  saving.value = module
  try {
    await setEnabled(module, next)
    showToast(
      next ? `Module "${MODULE_LABELS[module]}" active.` : `Module "${MODULE_LABELS[module]}" desactive.`,
      'success',
    )
  } catch {
    showToast('Erreur lors de la modification du module.', 'error')
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <div class="adm-modules">
    <p class="adm-modules-hint">
      Desactive un module pour le masquer a tous les utilisateurs (etudiants et enseignants).
      Les modules opt-in comme les Jeux restent visibles pour les enseignants meme desactives.
    </p>

    <ul class="adm-modules-list">
      <li
        v-for="id in MODULES"
        :key="id"
        class="adm-module-card"
        :class="{ 'adm-module-card--on': modules[id] }"
      >
        <div class="adm-module-icon">
          <component :is="MODULE_META[id].icon" :size="20" />
        </div>
        <div class="adm-module-body">
          <div class="adm-module-label">{{ MODULE_LABELS[id] }}</div>
          <div class="adm-module-desc">{{ MODULE_META[id].description }}</div>
        </div>
        <button
          class="adm-toggle"
          :class="{ 'adm-toggle--on': modules[id] }"
          :disabled="saving === id"
          :aria-pressed="modules[id]"
          :aria-label="`${modules[id] ? 'Desactiver' : 'Activer'} le module ${MODULE_LABELS[id]}`"
          @click="toggle(id)"
        >
          <span class="adm-toggle-knob" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.adm-modules {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 720px;
}

.adm-modules-hint {
  font-size: 13px;
  color: var(--text-muted);
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin: 0;
}

.adm-modules-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.adm-module-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color var(--t-fast) var(--ease-out);
}
.adm-module-card--on {
  border-color: rgba(var(--accent-rgb), 0.35);
}

.adm-module-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bg-active);
  color: var(--text-muted);
  flex-shrink: 0;
}
.adm-module-card--on .adm-module-icon {
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent);
}

.adm-module-body {
  flex: 1;
  min-width: 0;
}
.adm-module-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.adm-module-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.adm-toggle {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  position: relative;
  cursor: pointer;
  padding: 0;
  transition: background var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out);
  flex-shrink: 0;
}
.adm-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.adm-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: left var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out);
}
.adm-toggle--on {
  background: var(--accent);
  border-color: var(--accent);
}
.adm-toggle--on .adm-toggle-knob {
  left: 20px;
  background: #fff;
}
</style>
