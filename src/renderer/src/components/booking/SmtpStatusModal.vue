<script setup lang="ts">
/**
 * SmtpStatusModal — diagnostic SMTP cote prof/admin.
 *
 * Affiche le statut courant (configure, host, port, user masque, from,
 * reachability) et permet d'envoyer un mail de test. Cas d'usage :
 * verifier que les invitations de campagne vont partir, sans avoir a
 * SSH sur le VPS.
 */
import { computed, ref, watch } from 'vue'
import { Mail, CheckCircle, AlertTriangle, XCircle, Send, RotateCw } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useSmtpStatus } from '@/composables/useSmtpStatus'

interface Props {
  modelValue: boolean
  defaultTestEmail?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const { status, loading, sendingTest, refresh, sendTest } = useSmtpStatus()
const testEmail = ref('')

watch(() => props.modelValue, (open) => {
  if (open) {
    testEmail.value = props.defaultTestEmail ?? ''
    refresh(true)
  }
})

const overallState = computed<'ok' | 'warn' | 'ko'>(() => {
  const s = status.value
  if (!s || !s.configured) return 'ko'
  if (!s.reachable || !s.fromMatchesUser) return 'warn'
  return 'ok'
})

const overallTitle = computed(() => {
  switch (overallState.value) {
    case 'ok':   return 'Envoi de mails operationnel'
    case 'warn': return 'Envoi degrade'
    default:     return 'Envoi non configure'
  }
})

const issues = computed<string[]>(() => {
  const s = status.value
  const out: string[] = []
  if (!s) return out
  if (!s.configured) out.push("La variable d'environnement SMTP_HOST n'est pas definie sur le serveur. Configure-la dans le .env de ton VPS puis redemarre le service.")
  if (s.configured && !s.reachable) out.push(`Connexion au serveur SMTP impossible : ${s.error || 'raison inconnue'}.`)
  if (s.configured && !s.fromMatchesUser) out.push(`Le domaine de SMTP_FROM (${s.fromAddress}) ne correspond pas a celui de SMTP_USER (${s.userMasked}). Les mails risquent d'etre rejetes pour mismatch SPF/DMARC. Aligne SMTP_FROM sur le domaine de SMTP_USER.`)
  return out
})

const canTest = computed(() =>
  status.value?.configured
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.value.trim())
  && !sendingTest.value,
)

async function onSendTest() {
  if (!canTest.value) return
  await sendTest(testEmail.value.trim())
}

function close() { emit('update:modelValue', false) }
</script>

<template>
  <Modal :model-value="modelValue" title="Diagnostic envoi de mails" max-width="560px" @update:model-value="(v) => emit('update:modelValue', v)">
    <div class="ssm">
      <!-- Bandeau d'etat global -->
      <div class="ssm-banner" :class="`ssm-banner--${overallState}`">
        <component
          :is="overallState === 'ok' ? CheckCircle : overallState === 'warn' ? AlertTriangle : XCircle"
          :size="20"
          aria-hidden="true"
        />
        <div class="ssm-banner-text">
          <strong>{{ overallTitle }}</strong>
          <span v-if="loading" class="ssm-banner-sub">verification en cours...</span>
          <span v-else-if="status?.configured && status.reachable" class="ssm-banner-sub">
            Le serveur repond. Les invites de campagne seront envoyees.
          </span>
          <span v-else-if="status?.configured" class="ssm-banner-sub">
            La config est presente mais le serveur ne repond pas.
          </span>
          <span v-else class="ssm-banner-sub">
            Aucun mail ne partira tant que SMTP n'est pas configure.
          </span>
        </div>
        <button
          type="button"
          class="ssm-refresh"
          title="Rafraichir le diagnostic"
          :disabled="loading"
          @click="refresh(true)"
        >
          <RotateCw :size="13" :class="{ 'ssm-spin': loading }" />
        </button>
      </div>

      <!-- Issues / suggestions -->
      <ul v-if="issues.length > 0" class="ssm-issues">
        <li v-for="(msg, i) in issues" :key="i">{{ msg }}</li>
      </ul>

      <!-- Detail config -->
      <dl v-if="status" class="ssm-detail">
        <div class="ssm-detail-row">
          <dt>Hote SMTP</dt>
          <dd>{{ status.host || '—' }}</dd>
        </div>
        <div class="ssm-detail-row">
          <dt>Port</dt>
          <dd>{{ status.port }}{{ status.secure ? ' (SSL)' : ' (STARTTLS)' }}</dd>
        </div>
        <div class="ssm-detail-row">
          <dt>Utilisateur</dt>
          <dd>{{ status.userMasked || '—' }}</dd>
        </div>
        <div class="ssm-detail-row">
          <dt>Expediteur (From)</dt>
          <dd :class="{ 'ssm-detail-warn': status.configured && !status.fromMatchesUser }">
            {{ status.from || '—' }}
            <span v-if="status.configured && !status.fromMatchesUser" class="ssm-mismatch-tag" title="Le domaine ne correspond pas a SMTP_USER">mismatch</span>
          </dd>
        </div>
        <div class="ssm-detail-row">
          <dt>Source de la config</dt>
          <dd>
            <span :class="`ssm-source ssm-source--${status.sourceLabel}`">{{ status.sourceLabel === 'env' ? 'env vars' : 'default (non configure)' }}</span>
          </dd>
        </div>
      </dl>

      <!-- Test envoi -->
      <div class="ssm-test">
        <label for="ssm-test-email" class="ssm-test-label">
          <Mail :size="12" /> Envoyer un mail de test a
        </label>
        <div class="ssm-test-row">
          <input
            id="ssm-test-email"
            v-model="testEmail"
            type="email"
            class="ssm-input"
            placeholder="ton-email@gmail.com"
            :disabled="!status?.configured || sendingTest"
            @keydown.enter.prevent="onSendTest"
          />
          <UiButton
            variant="primary"
            type="button"
            :disabled="!canTest"
            :loading="sendingTest"
            @click="onSendTest"
          >
            <template #leading><Send :size="13" /></template>
            {{ sendingTest ? 'Envoi...' : 'Envoyer' }}
          </UiButton>
        </div>
        <p class="ssm-test-hint">
          Le mail s'envoie via la config serveur courante. Si tu ne le recois pas dans 1-2 min, verifie tes spams puis les logs serveur.
        </p>
      </div>

      <footer class="ssm-footer">
        <UiButton variant="ghost" type="button" @click="close">Fermer</UiButton>
      </footer>
    </div>
  </Modal>
</template>

<style scoped>
.ssm {
  display: flex; flex-direction: column; gap: 12px;
  font-family: var(--font);
  color: var(--text-primary);
}

/* ── Banner ── */
.ssm-banner {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
}
.ssm-banner--ok {
  border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
  background: color-mix(in srgb, var(--color-success) 8%, var(--bg-elevated));
  color: var(--color-success);
}
.ssm-banner--warn {
  border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--bg-elevated));
  color: var(--color-warning);
}
.ssm-banner--ko {
  border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
  background: color-mix(in srgb, var(--color-danger) 8%, var(--bg-elevated));
  color: var(--color-danger);
}
.ssm-banner-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1; min-width: 0;
}
.ssm-banner-text strong {
  font-size: 13px; font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}
.ssm-banner-sub {
  font-size: 12px; color: var(--text-secondary);
  line-height: 1.4;
}
.ssm-refresh {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: transparent; border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  cursor: pointer; flex-shrink: 0;
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out);
}
.ssm-refresh:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.ssm-refresh:disabled { opacity: .55; cursor: wait; }

@keyframes ssm-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.ssm-spin { animation: ssm-spin 1s linear infinite; }

/* ── Issues ── */
.ssm-issues {
  margin: 0; padding: 10px 14px 10px 28px;
  list-style: disc;
  background: color-mix(in srgb, var(--color-warning) 6%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--color-warning) 25%, transparent);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.ssm-issues li + li { margin-top: 6px; }

/* ── Detail ── */
.ssm-detail {
  margin: 0;
  display: flex; flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.ssm-detail-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  font-size: 12px;
}
.ssm-detail-row + .ssm-detail-row { border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent); }
.ssm-detail-row dt {
  font-weight: 600;
  color: var(--text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.ssm-detail-row dd {
  margin: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  color: var(--text-primary);
  font-size: 12px;
}
.ssm-detail-warn { color: var(--color-warning); }
.ssm-mismatch-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: var(--color-warning);
  color: #fff;
  font-family: var(--font);
  font-size: 9.5px;
  font-weight: 800;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.ssm-source { font-family: var(--font); }
.ssm-source--default { color: var(--color-danger); font-weight: 600; }
.ssm-source--env { color: var(--color-success); font-weight: 600; }

/* ── Test envoi ── */
.ssm-test {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.ssm-test-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .04em;
  color: var(--text-muted);
}
.ssm-test-row { display: flex; gap: 8px; align-items: center; }
.ssm-test-row > .ssm-input { flex: 1; min-width: 0; }
.ssm-input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  transition: border-color var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}
.ssm-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent); }
.ssm-input:disabled { opacity: .55; cursor: not-allowed; }
.ssm-test-hint { margin: 0; font-size: 11px; color: var(--text-muted); }

.ssm-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 6px;
  margin-top: 2px;
  border-top: 1px solid var(--border);
}

@media (prefers-reduced-motion: reduce) {
  .ssm-spin { animation: none; }
  .ssm-input, .ssm-refresh { transition: none; }
}
</style>
