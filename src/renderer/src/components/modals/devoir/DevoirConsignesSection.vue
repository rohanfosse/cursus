<script setup lang="ts">
  import { ref, computed } from 'vue'
  import {
    FileText, Award, Calendar, MapPin, Calculator, BookOpen, Clock,
  } from 'lucide-vue-next'
  import type { Travail } from '@/types'

  interface RessourceItem { id: number; name: string; type: string }

  const props = defineProps<{
    travail: Travail
    ressources: RessourceItem[]
  }>()
  const emit = defineEmits<{
    'save-description': [value: string]
    'open-ressources-modal': []
  }>()

  // ── Description editing ──────────────────────────────────────────────────
  const editingDesc = ref(false)
  const descDraft = ref('')
  function startEditDesc() { descDraft.value = props.travail.description ?? ''; editingDesc.value = true }
  function saveDesc() {
    emit('save-description', descDraft.value)
    editingDesc.value = false
  }

  // ── Parsed description ───────────────────────────────────────────────────
  const parsedDesc = computed(() => {
    const desc = props.travail.description ?? ''
    if (!desc) return null
    const fields: { label: string; value: string; iconKey: string }[] = []
    const sessionMatch = desc.match(/\*\*Session\s+(\w+)\*\*/)
    if (sessionMatch) fields.push({ label: 'Session', value: sessionMatch[1], iconKey: 'calendar' })
    const dureeMatch = desc.match(/Dur\u00e9e\s*:\s*(\d+)\s*min/i)
    if (dureeMatch) fields.push({ label: 'Duree', value: dureeMatch[1] + ' min', iconKey: 'clock' })
    const formatMatch = desc.match(/Format\s*:\s*(.+)/i)
    if (formatMatch) fields.push({ label: 'Format', value: formatMatch[1].trim(), iconKey: 'filetext' })
    if (/Calculatrice autoris\u00e9e/i.test(desc)) fields.push({ label: 'Calculatrice', value: 'Autorisee', iconKey: 'calculator' })
    else if (/Calculatrice non/i.test(desc)) fields.push({ label: 'Calculatrice', value: 'Non autorisee', iconKey: 'calculator' })
    const resMatch = desc.match(/(?:Aucune ressource|Ressources?\s*:\s*(.+))/i)
    if (resMatch) fields.push({ label: 'Ressources', value: resMatch[1] || 'Aucune', iconKey: 'bookopen' })
    const salleMatch = desc.match(/Salle\s*:\s*(.+)/i)
    if (salleMatch) fields.push({ label: 'Salle', value: salleMatch[1].trim(), iconKey: 'mappin' })
    const horaireMatch = desc.match(/Horaire\s*:\s*(.+)/i)
    if (horaireMatch) fields.push({ label: 'Horaire', value: horaireMatch[1].trim(), iconKey: 'clock' })
    return fields.length > 0 ? fields : null
  })

  const parsedIconMap: Record<string, object> = {
    calendar: Calendar, clock: Clock, calculator: Calculator,
    bookopen: BookOpen, mappin: MapPin, filetext: FileText,
  }
</script>

<template>
  <!-- ═══ CONSIGNES ═══ -->
  <section class="gd-section">
    <span class="gd-section-title"><FileText :size="12" /> Consignes</span>

    <template v-if="parsedDesc && !editingDesc">
      <div class="gd-parsed-fields">
        <div v-for="f in parsedDesc" :key="f.label" class="gd-parsed-field">
          <span class="gd-parsed-icon"><component :is="parsedIconMap[f.iconKey]" :size="13" /></span>
          <span class="gd-parsed-label">{{ f.label }}</span>
          <span class="gd-parsed-value">{{ f.value }}</span>
        </div>
      </div>
      <button class="gd-link-btn" style="margin-top:6px" @click="startEditDesc">Modifier la description</button>
    </template>

    <template v-else-if="!editingDesc">
      <div class="gd-description" role="button" tabindex="0" title="Cliquer pour modifier" aria-label="Modifier la description" @click="startEditDesc" @keydown.enter="startEditDesc" @keydown.space.prevent="startEditDesc">
        <pre class="gd-desc-pre">{{ travail.description || 'Aucune description - cliquez pour en ajouter.' }}</pre>
      </div>
    </template>

    <div v-else class="gd-desc-edit">
      <textarea v-model="descDraft" autofocus class="gd-desc-textarea" rows="4" />
      <div class="gd-desc-edit-actions">
        <button class="btn-ghost" style="font-size:11px" @click="editingDesc = false">Annuler</button>
        <button class="btn-cta" style="font-size:11px;padding:3px 10px" @click="saveDesc">OK</button>
      </div>
    </div>
  </section>

  <!-- ═══ AAVs ═══ -->
  <section v-if="travail.aavs" class="gd-section">
    <span class="gd-section-title"><Award :size="12" /> Objectifs d'apprentissage</span>
    <p class="gd-aavs">{{ travail.aavs }}</p>
  </section>

  <!-- ═══ RESSOURCES ═══ -->
  <section class="gd-section">
    <span class="gd-section-title"><FileText :size="12" /> Ressources ({{ ressources.length }})</span>
    <div v-for="r in ressources" :key="r.id" class="gd-resource-item">
      <FileText :size="12" style="opacity:.5" />
      <span>{{ r.name }}</span>
    </div>
    <button class="gd-link-btn" style="margin-top:4px" @click="emit('open-ressources-modal')">+ Gerer les ressources</button>
  </section>
</template>

<style scoped>
.gd-section { padding: 8px 20px; }
.gd-section-title {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px;
}
.gd-aavs {
  font-size: 13px; color: var(--text-secondary); line-height: 1.5;
  padding: 6px 10px; background: var(--bg-elevated); border-radius: var(--radius-sm);
  white-space: pre-wrap;
}
.gd-resource-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-secondary); padding: 3px 0;
}
.gd-parsed-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.gd-parsed-field {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); font-size: 13px;
}
.gd-parsed-icon { font-size: 14px; flex-shrink: 0; }
.gd-parsed-label {
  font-size: 10px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .3px; min-width: 55px;
}
.gd-parsed-value { color: var(--text-primary); font-weight: 500; }
@media (max-width: 450px) { .gd-parsed-fields { grid-template-columns: 1fr; } }

.gd-description {
  font-size: 13px; color: var(--text-secondary); line-height: 1.5;
  padding: 8px 12px; background: var(--bg-elevated); border-radius: var(--radius-sm);
  border-left: 3px solid var(--border-input); cursor: pointer;
  transition: background var(--t-fast);
}
.gd-description:hover { background: var(--bg-hover); }
.gd-desc-pre {
  font-family: var(--font); font-size: 13px; white-space: pre-wrap;
  line-height: 1.5; margin: 0; color: var(--text-secondary);
}
.gd-desc-edit { margin-bottom: 6px; }
.gd-desc-textarea {
  width: 100%; background: var(--bg-input); border: 1px solid var(--border-input);
  border-radius: var(--radius-sm); padding: 8px; color: var(--text-primary); font-size: 13px;
  font-family: var(--font); resize: vertical;
}
.gd-desc-edit-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }

.gd-link-btn {
  font-size: 12px; color: var(--accent); background: none; border: none;
  cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--font);
}
.gd-link-btn:hover { text-decoration: underline; }
</style>
