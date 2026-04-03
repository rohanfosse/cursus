<script setup lang="ts">
  import {
    BookMarked, BookOpen, Github, Linkedin, Globe, Package,
    ClipboardList, GraduationCap, ShieldCheck, HelpCircle,
  } from 'lucide-vue-next'
  import type { Component } from 'vue'
  import Modal from '@/components/ui/Modal.vue'
  import { useDocumentsEdit } from '@/composables/useDocumentsEdit'

  const {
    showEditModal, editName, editCategory, editDescription,
    editTravailId, travailList: editTravailList,
    saving, submitEdit,
  } = useDocumentsEdit()

  const CATEGORIES: { id: string; label: string; icon: Component; color: string }[] = [
    { id: 'moodle',   label: 'Moodle',    icon: BookOpen,   color: '#f59e0b' },
    { id: 'github',   label: 'GitHub',    icon: Github,     color: '#24292e' },
    { id: 'linkedin', label: 'LinkedIn',  icon: Linkedin,   color: '#0a66c2' },
    { id: 'web',      label: 'Site Web',  icon: Globe,      color: '#22c55e' },
    { id: 'package',  label: 'Package',   icon: Package,       color: '#8b5cf6' },
    { id: 'grille',   label: 'Grille',    icon: ClipboardList, color: '#ef4444' },
    { id: 'note-peda', label: 'Note Peda', icon: GraduationCap, color: '#06b6d4' },
    { id: 'fiche-validation', label: 'Fiche de validation', icon: ShieldCheck, color: '#10b981' },
    { id: 'autre',    label: 'Autre',     icon: HelpCircle,    color: '#8b8d91' },
  ]
</script>

<template>
  <Modal v-model="showEditModal" title="Modifier le document" max-width="520px">
    <form class="da" @submit.prevent="submitEdit">
      <div class="da-field">
        <label class="da-label">Nom du document</label>
        <input v-model="editName" type="text" class="da-input" placeholder="ex : Cours reseaux" autofocus />
      </div>

      <div class="da-field">
        <label class="da-label">Categorie</label>
        <div class="da-cat-pills">
          <button
            v-for="cat in CATEGORIES" :key="cat.id" type="button" class="da-cat-pill"
            :class="{ active: editCategory === cat.label }"
            :style="editCategory === cat.label ? { background: cat.color + '22', color: cat.color, borderColor: cat.color } : {}"
            @click="editCategory = cat.label"
          ><component :is="cat.icon" :size="12" /> {{ cat.label }}</button>
        </div>
      </div>

      <div v-if="editTravailList.length" class="da-field">
        <label class="da-label">Lien vers un devoir <span class="da-hint">(optionnel)</span></label>
        <div class="da-travail-select-wrap">
          <BookMarked :size="14" class="da-travail-icon" />
          <select v-model="editTravailId" class="da-input da-travail-select" aria-label="Lien vers un devoir">
            <option :value="null">-- Aucun --</option>
            <option v-for="t in editTravailList" :key="t.id" :value="t.id">{{ t.title }}{{ t.category ? ` · ${t.category}` : '' }}</option>
          </select>
        </div>
      </div>

      <div class="da-field">
        <label class="da-label">Description <span class="da-hint">(optionnelle)</span></label>
        <textarea v-model="editDescription" class="da-input da-textarea" rows="2" placeholder="Breve description..." />
      </div>

      <div class="da-footer">
        <button type="button" class="btn-ghost" @click="showEditModal = false">Annuler</button>
        <button type="submit" class="btn-primary da-submit" :disabled="!editName.trim() || saving">
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
