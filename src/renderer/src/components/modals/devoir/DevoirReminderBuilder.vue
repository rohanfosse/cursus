<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Bell } from 'lucide-vue-next'
  import { formatDate } from '@/utils/date'
  import type { Devoir } from '@/types'

  interface DevoirMeta {
    salle: string | null
    duree: string | null
    session: string | null
    calculatrice: boolean
    ressources: string | null
    aavs: string | null
    isEvent: boolean
  }

  interface Props {
    travail: Devoir
    meta: DevoirMeta
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    'send': [message: string]
    'close': []
  }>()

  const sending = ref(false)
  const opts = ref({
    deadline: true,
    salle: !!props.meta.salle,
    duree: !!props.meta.duree && props.meta.isEvent,
    ressources: props.meta.isEvent && !!props.meta.ressources,
    aavs: false,
    lien: true,
    custom: '',
  })

  const preview = computed(() => {
    const t = props.travail
    const m = props.meta
    const parts: string[] = []

    parts.push('@everyone Bonjour,')
    parts.push('')

    if (opts.value.lien) {
      parts.push(`\\[${t.title}](devoir:${t.id})`)
    } else {
      parts.push(`**${t.title}**`)
    }

    if (opts.value.deadline) {
      if (m.isEvent) {
        let line = `le **${formatDate(t.deadline)}**`
        if (m.session) line += ` (session ${m.session})`
        parts.push(line)
      } else {
        parts.push(`a rendre avant le **${formatDate(t.deadline)}**`)
      }
    }

    if (opts.value.duree && m.duree) parts.push(`Duree : ${m.duree} min`)
    if (opts.value.salle && m.salle) parts.push(`Salle : **${m.salle}**`)

    if (opts.value.ressources && m.isEvent && m.ressources) {
      const calc = m.calculatrice ? 'calculatrice autorisee' : 'calculatrice non autorisee'
      parts.push(`${m.ressources === 'Aucune' ? 'Aucune ressource autorisee' : `Ressources : ${m.ressources}`}, ${calc}`)
    }

    if (opts.value.aavs && m.aavs) {
      parts.push(`Competences evaluees : ${m.aavs.split('\n').filter(Boolean).join(', ')}`)
    }

    if (opts.value.custom.trim()) parts.push(opts.value.custom.trim())

    return parts.join('\n')
  })

  async function send() {
    if (!preview.value.trim() || sending.value) return
    sending.value = true
    try {
      emit('send', preview.value)
    } finally {
      sending.value = false
    }
  }
</script>

<template>
  <div class="reminder-builder">
    <div class="reminder-header">
      <Bell :size="14" />
      <span>Composer le rappel</span>
      <button class="reminder-close" @click="emit('close')">&times;</button>
    </div>

    <p class="reminder-hint">Cochez les informations a inclure dans le message.</p>

    <div class="reminder-options">
      <label class="reminder-opt">
        <input v-model="opts.lien" type="checkbox" />
        Lien vers le devoir
      </label>
      <label class="reminder-opt">
        <input v-model="opts.deadline" type="checkbox" />
        {{ meta.isEvent ? 'Date et heure' : 'Date limite' }}
      </label>
      <label v-if="meta.duree" class="reminder-opt">
        <input v-model="opts.duree" type="checkbox" />
        Duree ({{ meta.duree }} min)
      </label>
      <label v-if="meta.salle" class="reminder-opt">
        <input v-model="opts.salle" type="checkbox" />
        Salle ({{ meta.salle }})
      </label>
      <label v-if="meta.isEvent && meta.ressources" class="reminder-opt">
        <input v-model="opts.ressources" type="checkbox" />
        Ressources autorisees
      </label>
      <label v-if="meta.aavs" class="reminder-opt">
        <input v-model="opts.aavs" type="checkbox" />
        Competences evaluees (AAVs)
      </label>
    </div>

    <div class="reminder-custom">
      <input
        v-model="opts.custom"
        type="text" class="form-input"
        placeholder="Message personnalise (optionnel)"
        style="font-size:12px"
      />
    </div>

    <div class="reminder-preview">
      <span class="reminder-preview-label">Apercu :</span>
      <div class="reminder-preview-text">{{ preview }}</div>
    </div>

    <div class="reminder-footer">
      <button class="btn-ghost" style="font-size:12px" @click="emit('close')">Annuler</button>
      <button
        class="btn-cta" style="font-size:12px"
        :disabled="!preview.trim() || sending"
        @click="send"
      >
        {{ sending ? 'Envoi...' : 'Envoyer dans le canal' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.reminder-builder {
  margin-top: 10px; padding: 14px; border-radius: var(--radius);
  background: var(--bg-elevated); border: 1px solid var(--border);
}
.reminder-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin-bottom: 8px;
}
.reminder-close {
  margin-left: auto; background: none; border: none; color: var(--text-muted);
  font-size: 18px; cursor: pointer; line-height: 1; padding: 2px 6px;
}
.reminder-close:hover { color: var(--text-primary); }
.reminder-hint {
  font-size: 12px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;
}
.reminder-options {
  display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;
}
.reminder-opt {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-secondary); cursor: pointer;
}
.reminder-opt input { accent-color: var(--accent); }
.reminder-custom { margin-bottom: 12px; }
.reminder-preview {
  padding: 10px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); border: 1px solid var(--border);
  margin-bottom: 12px;
}
.reminder-preview-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; color: var(--text-muted); display: block; margin-bottom: 6px;
}
.reminder-preview-text {
  font-size: 13px; color: var(--text-primary); white-space: pre-line; line-height: 1.5;
}
.reminder-footer {
  display: flex; justify-content: flex-end; gap: 8px;
}
</style>
