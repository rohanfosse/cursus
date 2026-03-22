/** StudentDepositForm.vue — Inline deposit form: file/link toggle, picker, submit */
<script setup lang="ts">
import {
  CheckCircle2, Upload, Link2, X, FileText, LayoutList, Loader2,
} from 'lucide-vue-next'
import type { Rubric } from '@/types'

defineProps<{
  depositMode: 'file' | 'link'
  depositLink: string
  depositFile: string | null
  depositFileName: string | null
  depositing: boolean
  expired: boolean
  depositFileSize?: number | null
  rubricPreview: Rubric | null
}>()

defineEmits<{
  'update:depositMode': [v: 'file' | 'link']
  'update:depositLink': [v: string]
  pickFile: []
  clearFile: []
  cancel: []
  submit: []
}>()
</script>

<template>
  <div class="deposit-form">
    <div class="deposit-type-toggle">
      <button class="deposit-toggle-btn" :class="{ active: depositMode === 'file' }" @click="$emit('update:depositMode', 'file')">
        <FileText :size="12" /> Fichier
      </button>
      <button class="deposit-toggle-btn" :class="{ active: depositMode === 'link' }" @click="$emit('update:depositMode', 'link')">
        <Link2 :size="12" /> Lien URL
      </button>
    </div>
    <div v-if="depositMode === 'file'">
      <div v-if="depositFile" class="deposit-file-selected">
        <CheckCircle2 :size="15" class="deposit-file-selected-icon" />
        <span class="deposit-file-selected-name">{{ depositFileName }}<template v-if="depositFileSize"> &middot; {{ (depositFileSize / 1_048_576).toFixed(1) }} Mo</template></span>
        <button class="deposit-file-selected-clear" type="button" @click.stop="$emit('clearFile')">
          <X :size="12" />
        </button>
      </div>
      <div v-else class="deposit-file-zone" @click="$emit('pickFile')">
        <Upload :size="20" class="deposit-file-zone-icon" />
        <span class="deposit-file-zone-label">Cliquer pour choisir un fichier</span>
        <span class="deposit-file-zone-hint">PDF, images, archives... &middot; Max 50 Mo</span>
      </div>
    </div>
    <input v-else :value="depositLink" class="form-input" placeholder="https://..." type="url" @input="$emit('update:depositLink', ($event.target as HTMLInputElement).value)" @keydown.enter="$emit('submit')" />
    <div v-if="rubricPreview" class="rubric-preview">
      <div class="rubric-preview-header">
        <LayoutList :size="12" />
        <span>{{ rubricPreview.title }}</span>
      </div>
      <div class="rubric-preview-criteria">
        <div v-for="c in rubricPreview.criteria" :key="c.id" class="rubric-preview-criterion">
          <span class="rubric-preview-label">{{ c.label }}</span>
          <span class="rubric-preview-pts">/ {{ c.max_pts }} pt{{ c.max_pts > 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>
    <div class="deposit-actions">
      <button class="btn-ghost btn-deposit-cancel" @click="$emit('cancel')">
        <X :size="12" /> Annuler
      </button>
      <button
        class="btn-primary btn-deposit-submit"
        :disabled="depositing || expired || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
        @click="$emit('submit')"
      >
        <Loader2 v-if="depositing" :size="12" class="spin" />
        <Upload v-else :size="12" />
        {{ depositing ? 'Depot...' : expired ? 'Delai expire' : 'Deposer' }}
      </button>
    </div>
  </div>
</template>
