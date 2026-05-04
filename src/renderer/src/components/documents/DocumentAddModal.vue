<script setup lang="ts">
  import {
    Upload, Link2, Plus, X, CheckCircle2, BookMarked,
    BookOpen, Github, Linkedin, Globe, Package, ClipboardList,
    GraduationCap, ShieldCheck, HelpCircle,
  } from 'lucide-vue-next'
  import type { Component } from 'vue'
  import Modal from '@/components/ui/Modal.vue'
  import { useDocumentsAdd } from '@/composables/useDocumentsAdd'

  const {
    showAddModal,
    addName, addCategory, addDescription, addType, addLink, addFiles,
    addTravailId, travailList,
    adding, uploadProgress, uploadCurrentIndex, uploadTotal,
    modalDragOver,
    pickFile, removeFile, submitAdd, detectCategory,
    onModalDragEnter, onModalDragLeave, onModalDragOver, onModalDrop,
  } = useDocumentsAdd()

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

  defineExpose({ open: () => { showAddModal.value = true } })
</script>

<template>
  <Modal v-model="showAddModal" title="Ajouter un document" max-width="520px">
    <form class="da" @submit.prevent="submitAdd">
      <div class="da-type-row">
        <button class="da-type-btn" :class="{ active: addType === 'file' }" type="button" @click="addType = 'file'">
          <Upload :size="15" /> Fichier{{ addFiles.length > 1 ? 's' : '' }}
        </button>
        <button class="da-type-btn" :class="{ active: addType === 'link' }" type="button" @click="addType = 'link'">
          <Link2 :size="15" /> Lien URL
        </button>
      </div>

      <div
        v-if="addType === 'file'"
        class="da-drop-zone"
        :class="{ 'da-drop-zone--active': modalDragOver }"
        @dragenter="onModalDragEnter"
        @dragleave="onModalDragLeave"
        @dragover="onModalDragOver"
        @drop="onModalDrop"
      >
        <div v-if="addFiles.length" class="da-files-list">
          <div v-for="(f, idx) in addFiles" :key="f.path" class="da-file-selected">
            <CheckCircle2 :size="16" class="da-file-icon" />
            <div class="da-file-info"><span class="da-file-name">{{ f.name }}</span></div>
            <button class="da-file-clear" type="button" title="Retirer" @click="removeFile(idx)"><X :size="14" /></button>
          </div>
          <button class="da-add-more" type="button" @click="pickFile"><Plus :size="14" /> Ajouter d'autres fichiers</button>
        </div>
        <button v-else class="da-file-picker" type="button" @click="pickFile">
          <Upload :size="24" class="da-picker-icon" />
          <span class="da-picker-label">Cliquer ou glisser des fichiers ici</span>
          <span class="da-picker-hint">PDF, Word, Excel, images, videos, archives</span>
        </button>
      </div>

      <div v-if="adding && uploadTotal > 0" class="da-progress">
        <div class="da-progress-bar"><div class="da-progress-fill" :style="{ width: uploadProgress + '%' }" /></div>
        <span class="da-progress-text">Fichier {{ uploadCurrentIndex }}/{{ uploadTotal }}... {{ uploadProgress }}%</span>
      </div>

      <div v-if="addType === 'link'" class="da-field">
        <label class="da-label">Adresse URL</label>
        <input v-model="addLink" type="url" class="da-input" placeholder="https://..." @blur="detectCategory(addLink)" />
      </div>

      <div v-if="addType === 'link' || addFiles.length <= 1" class="da-field">
        <label class="da-label">Nom du document</label>
        <input v-model="addName" type="text" class="da-input" placeholder="ex : Cours reseaux" autofocus />
      </div>

      <div class="da-field">
        <label class="da-label">Categorie</label>
        <div class="da-cat-pills">
          <button
            v-for="cat in CATEGORIES" :key="cat.id" type="button" class="da-cat-pill"
            :class="{ active: addCategory === cat.label }"
            :style="addCategory === cat.label ? { background: cat.color + '22', color: cat.color, borderColor: cat.color } : {}"
            @click="addCategory = cat.label"
          ><component :is="cat.icon" :size="12" /> {{ cat.label }}</button>
        </div>
      </div>

      <div v-if="travailList.length" class="da-field">
        <label class="da-label">Lien vers un devoir <span class="da-hint">(optionnel)</span></label>
        <div class="da-travail-select-wrap">
          <BookMarked :size="14" class="da-travail-icon" />
          <select v-model="addTravailId" class="da-input da-travail-select" aria-label="Lien vers un devoir">
            <option :value="null">-- Aucun --</option>
            <option v-for="t in travailList" :key="t.id" :value="t.id">{{ t.title }}{{ t.category ? ` · ${t.category}` : '' }}</option>
          </select>
        </div>
      </div>

      <div class="da-field">
        <label class="da-label">Description <span class="da-hint">(optionnelle)</span></label>
        <textarea v-model="addDescription" class="da-input da-textarea" rows="2" placeholder="Breve description..." />
      </div>

      <div class="da-footer">
        <button type="button" class="btn-ghost" @click="showAddModal = false">Annuler</button>
        <button type="submit" class="btn-cta da-submit"
          :disabled="(addType === 'file' ? !addFiles.length : (!addName.trim() || !addLink.trim())) || (addType === 'file' && addFiles.length === 1 && !addName.trim()) || adding"
        >{{ adding ? (uploadTotal > 1 ? `Envoi ${uploadCurrentIndex}/${uploadTotal}...` : 'Envoi...') : (addFiles.length > 1 ? `Ajouter ${addFiles.length} fichiers` : 'Ajouter') }}</button>
      </div>
    </form>
  </Modal>
</template>
