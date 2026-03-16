<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
  import { BarChart2, List, Plus, Upload, Link2, X, FileText, CheckCircle2, Clock, Lock } from 'lucide-vue-next'
  import { useAppStore }     from '@/stores/app'
  import { useTravauxStore } from '@/stores/travaux'
  import { useModalsStore }  from '@/stores/modals'
  import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
  import { avatarColor, initials } from '@/utils/format'
  import type { Travail } from '@/types'

  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const modals       = useModalsStore()

  const promoFilter = ref<number | null>(null)
  const promotions  = ref<{ id: number; name: string }[]>([])

  const activePromoId = computed(() => promoFilter.value ?? appStore.activePromoId)

  // ── Horloge temps réel pour verrouillage des deadlines ───────────────────
  /**
   * Pourquoi une horloge 30 s plutôt que requestAnimationFrame ?
   *   - rAF tourne à 60 fps = 60 appels/s × N cartes → inutile et coûteux
   *   - Les deadlines sont à la minute près; un intervalle de 30 s est
   *     suffisant tout en réagissant dans la demi-minute suivant l'expiration
   *   - Nettoyé dans onBeforeUnmount → zéro fuite mémoire
   */
  const now = ref(Date.now())
  let clockInterval: ReturnType<typeof setInterval> | null = null

  /** Renvoie true si la deadline est passée (verrouille le bouton Déposer) */
  function isExpired(deadline: string): boolean {
    return now.value >= new Date(deadline).getTime()
  }

  // Dépôt inline (étudiant)
  const depositingTravailId = ref<number | null>(null)
  const depositMode         = ref<'file' | 'link'>('file')
  const depositLink         = ref('')
  const depositFile         = ref<string | null>(null)
  const depositFileName     = ref<string | null>(null)
  const depositing          = ref(false)

  onMounted(async () => {
    clockInterval = setInterval(() => { now.value = Date.now() }, 30_000)

    const res = await window.api.getPromotions()
    promotions.value = res?.ok ? res.data : []
    if (!promoFilter.value && promotions.value.length) {
      promoFilter.value = promotions.value[0].id
    }
    await loadView()
  })

  onBeforeUnmount(() => {
    if (clockInterval !== null) clearInterval(clockInterval)
  })

  async function loadView() {
    if (appStore.isStudent) {
      await travauxStore.fetchStudentTravaux()
    } else {
      if (!activePromoId.value) return
      if (travauxStore.view === 'gantt') await travauxStore.fetchGantt(activePromoId.value)
      if (travauxStore.view === 'rendus') await travauxStore.fetchRendus(activePromoId.value)
    }
  }

  watch(() => travauxStore.view, loadView)
  watch(promoFilter, loadView)

  // ── Dépôt étudiant ────────────────────────────────────────────────────────
  function startDeposit(t: Travail) {
    depositingTravailId.value = t.id
    depositMode.value         = 'file'
    depositLink.value         = ''
    depositFile.value         = null
    depositFileName.value     = null
  }

  function cancelDeposit() {
    depositingTravailId.value = null
  }

  async function pickFile() {
    const res = await window.api.openFileDialog()
    if (res?.ok && res.data) {
      depositFile.value     = res.data
      depositFileName.value = res.data.split(/[\\/]/).pop() ?? res.data
    }
  }

  async function submitDeposit(travail: Travail) {
    // ── Debounce / double-clic ─────────────────────────────────────────────
    // depositing.value agit comme mutex : posé synchroniquement avant tout
    // await, donc aucun second clic ne peut passer avant la fin du premier.
    if (depositing.value) return
    if (!appStore.currentUser) return
    if (depositMode.value === 'file' && !depositFile.value) return
    if (depositMode.value === 'link' && !depositLink.value.trim()) return
    // Vérification deadline côté client (la DB valide aussi côté serveur)
    if (isExpired(travail.deadline)) return

    depositing.value = true
    try {
      const ok = await travauxStore.addDepot({
        travail_id: travail.id,
        student_id: appStore.currentUser.id,
        type:       depositMode.value,
        content:    depositMode.value === 'file' ? depositFile.value! : depositLink.value.trim(),
        file_name:  depositMode.value === 'file' ? depositFileName.value : null,
      })
      if (ok) {
        cancelDeposit()
        await travauxStore.fetchStudentTravaux()
      }
    } finally {
      depositing.value = false
    }
  }

  // ── Vue prof : ouvrir un travail ──────────────────────────────────────────
  async function openTravail(travailId: number) {
    appStore.currentTravailId = travailId
    await travauxStore.openTravail(travailId)
    modals.gestionDevoir = true
  }

  // ── Gantt : calcul des positions ──────────────────────────────────────────
  const ganttItems = computed(() => {
    const items = travauxStore.ganttData as Travail[]
    if (!items.length) return []

    const dates = items.flatMap((t) => [
      t.start_date ? new Date(t.start_date).getTime() : new Date(t.deadline).getTime() - 7 * 86400000,
      new Date(t.deadline).getTime(),
    ])
    const minT = Math.min(...dates)
    const maxT = Math.max(...dates)
    const span = maxT - minT || 1

    return items.map((t) => {
      const startMs  = t.start_date
        ? new Date(t.start_date).getTime()
        : new Date(t.deadline).getTime() - 7 * 86400000
      const endMs    = new Date(t.deadline).getTime()
      const left     = ((startMs - minT) / span) * 100
      const width    = Math.max(((endMs - startMs) / span) * 100, 2)
      return { ...t, left, width, dlClass: deadlineClass(t.deadline) }
    })
  })

  // ── Rendus : grouper par travail ─────────────────────────────────────────
  const rendusByTravail = computed(() => {
    const map = new Map<number, { travail: Partial<Travail>; rendus: typeof travauxStore.allRendus }>()
    for (const r of travauxStore.allRendus) {
      if (!map.has(r.travail_id)) {
        map.set(r.travail_id, { travail: { id: r.travail_id }, rendus: [] })
      }
      map.get(r.travail_id)!.rendus.push(r)
    }
    return [...map.values()]
  })
</script>

<template>
  <div class="travaux-area">
    <!-- ── En-tête ──────────────────────────────────────────────────────────── -->
    <header class="travaux-header">
      <div class="travaux-header-title">
        <BarChart2 :size="18" />
        <span>Travaux</span>
      </div>

      <div class="travaux-header-actions">
        <!-- Filtre promo (prof) -->
        <select
          v-if="appStore.isTeacher && promotions.length"
          v-model="promoFilter"
          class="form-select"
          style="font-size:13px;padding:5px 8px;width:auto"
        >
          <option v-for="p in promotions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>

        <!-- Toggle vue (prof) -->
        <template v-if="appStore.isTeacher">
          <div class="travaux-view-toggle">
            <button
              class="view-toggle-btn"
              :class="{ active: travauxStore.view === 'gantt' }"
              @click="travauxStore.setView('gantt')"
            >
              <BarChart2 :size="13" /> Gantt
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: travauxStore.view === 'rendus' }"
              @click="travauxStore.setView('rendus')"
            >
              <List :size="13" /> Rendus
            </button>
          </div>

          <button class="btn-primary" style="font-size:13px;padding:6px 12px" @click="modals.newTravail = true">
            <Plus :size="14" /> Nouveau
          </button>
        </template>
      </div>
    </header>

    <!-- ── Contenu principal ───────────────────────────────────────────────── -->
    <div class="travaux-content">

      <!-- ════ Vue ÉTUDIANT ════ -->
      <template v-if="appStore.isStudent">
        <div v-if="travauxStore.loading" class="travaux-list">
          <div v-for="i in 3" :key="i" class="skel-travail-card">
            <div class="skel skel-line skel-w50" style="height:16px" />
            <div class="skel skel-line skel-w90" style="height:12px;margin-top:8px" />
            <div class="skel skel-line skel-w30" style="height:10px;margin-top:6px" />
          </div>
        </div>

        <div v-else-if="travauxStore.travaux.length === 0" class="empty-hint">
          <CheckCircle2 :size="40" style="opacity:.3;margin-bottom:12px" />
          <h3>Aucun travail assigné</h3>
          <p>Vos travaux apparaîtront ici dès qu'un enseignant en créera.</p>
        </div>

        <div v-else class="travaux-list">
          <div
            v-for="t in travauxStore.travaux"
            :key="t.id"
            class="travail-student-card"
            :class="{ submitted: t.depot_id != null }"
          >
            <!-- En-tête de la carte -->
            <div class="travail-card-header">
              <div class="travail-card-meta">
                <span class="travail-type-badge" :class="`type-${t.type}`">{{ t.type }}</span>
                <span v-if="t.category" class="tag-badge">{{ t.category }}</span>
                <span v-if="t.channel_name" class="travail-channel"># {{ t.channel_name }}</span>
              </div>
              <span class="deadline-badge" :class="deadlineClass(t.deadline)">
                <Clock :size="10" style="vertical-align:middle;margin-right:3px" />
                {{ deadlineLabel(t.deadline) }}
              </span>
            </div>

            <h3 class="travail-card-title">{{ t.title }}</h3>
            <p v-if="t.description" class="travail-card-desc">{{ t.description }}</p>

            <!-- Statut : soumis -->
            <div v-if="t.depot_id != null" class="travail-submitted-info">
              <CheckCircle2 :size="14" style="color:var(--color-success)" />
              <span>Rendu déposé</span>
            </div>

            <!-- Formulaire de dépôt inline -->
            <template v-else-if="depositingTravailId === t.id">
              <div class="deposit-form">
                <!-- Onglets Fichier / Lien -->
                <div class="deposit-tabs">
                  <button
                    class="deposit-tab"
                    :class="{ active: depositMode === 'file' }"
                    @click="depositMode = 'file'"
                  >
                    <FileText :size="12" /> Fichier
                  </button>
                  <button
                    class="deposit-tab"
                    :class="{ active: depositMode === 'link' }"
                    @click="depositMode = 'link'"
                  >
                    <Link2 :size="12" /> Lien
                  </button>
                </div>

                <div v-if="depositMode === 'file'" class="deposit-file-row">
                  <button class="btn-ghost" style="font-size:12px;flex:1" @click="pickFile">
                    <Upload :size="13" />
                    {{ depositFileName ?? 'Choisir un fichier…' }}
                  </button>
                </div>
                <div v-else class="deposit-link-row">
                  <input
                    v-model="depositLink"
                    class="form-input"
                    placeholder="https://…"
                    type="url"
                  />
                </div>

                <div class="deposit-actions">
                  <button class="btn-ghost" style="font-size:12px" @click="cancelDeposit">
                    <X :size="12" /> Annuler
                  </button>
                  <button
                    class="btn-primary"
                    style="font-size:12px"
                    :disabled="depositing || isExpired(t.deadline) || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
                    :title="isExpired(t.deadline) ? 'Délai de soumission expiré' : undefined"
                    @click="submitDeposit(t)"
                  >
                    <Upload :size="12" />
                    {{ depositing ? 'Dépôt…' : isExpired(t.deadline) ? 'Délai expiré' : 'Déposer' }}
                  </button>
                </div>
              </div>
            </template>

            <!-- Bouton Déposer (verrouillé si deadline expirée) -->
            <div v-else class="travail-card-footer">
              <span class="travail-deadline-date">Échéance : {{ formatDate(t.deadline) }}</span>
              <button
                class="btn-primary"
                style="font-size:12px;padding:5px 12px"
                :disabled="isExpired(t.deadline)"
                :title="isExpired(t.deadline) ? 'Délai de soumission expiré' : 'Déposer un travail'"
                @click="startDeposit(t)"
              >
                <Lock v-if="isExpired(t.deadline)" :size="12" />
                <Upload v-else :size="12" />
                {{ isExpired(t.deadline) ? 'Délai expiré' : 'Déposer' }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- ════ Vue GANTT (prof) ════ -->
      <template v-else-if="travauxStore.view === 'gantt'">
        <div v-if="travauxStore.loading" class="empty-hint">
          <div class="skel skel-line skel-w70" style="height:14px;margin:0 auto 8px" />
          <div class="skel skel-line skel-w90" style="height:14px;margin:0 auto 8px" />
          <div class="skel skel-line skel-w50" style="height:14px;margin:0 auto" />
        </div>

        <div v-else-if="ganttItems.length === 0" class="empty-hint">
          <h3>Aucun travail créé</h3>
          <p>Créez un premier travail pour visualiser le Gantt.</p>
        </div>

        <div v-else class="gantt-wrapper">
          <div class="gantt-legend">
            <span class="gantt-legend-item type-devoir">Devoir</span>
            <span class="gantt-legend-item type-projet">Projet</span>
            <span class="gantt-legend-item type-jalon">Jalon</span>
          </div>
          <div class="gantt-chart">
            <div
              v-for="item in ganttItems"
              :key="item.id"
              class="gantt-row"
              @click="openTravail(item.id)"
            >
              <div class="gantt-row-label">
                <span class="gantt-label-name">{{ item.title }}</span>
                <span class="deadline-badge" :class="item.dlClass" style="font-size:10px">
                  {{ formatDate(item.deadline) }}
                </span>
              </div>
              <div class="gantt-track">
                <div
                  class="gantt-bar"
                  :class="`type-${item.type}`"
                  :style="{ left: item.left + '%', width: item.width + '%' }"
                  :title="item.title"
                />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ════ Vue RENDUS (prof) ════ -->
      <template v-else>
        <div v-if="travauxStore.loading" class="travaux-list">
          <div v-for="i in 3" :key="i" class="skel-travail-card">
            <div class="skel skel-line skel-w50" style="height:16px" />
            <div class="skel skel-line skel-w30" style="height:12px;margin-top:8px" />
          </div>
        </div>

        <div v-else-if="rendusByTravail.length === 0" class="empty-hint">
          <h3>Aucun rendu pour cette promotion</h3>
          <p>Les rendus des étudiants apparaîtront ici.</p>
        </div>

        <div v-else class="travaux-list">
          <div
            v-for="group in rendusByTravail"
            :key="group.travail.id"
            class="rendus-group"
          >
            <div class="rendus-group-header" @click="openTravail(group.travail.id!)">
              <span class="rendus-group-title">Travail #{{ group.travail.id }}</span>
              <span class="rendus-count-badge">{{ group.rendus.length }} rendu{{ group.rendus.length > 1 ? 's' : '' }}</span>
            </div>

            <div class="rendus-list">
              <div v-for="r in group.rendus" :key="r.id" class="rendu-row">
                <div
                  class="avatar"
                  :style="{ background: avatarColor(r.student_name), width: '28px', height: '28px', fontSize: '10px' }"
                >
                  {{ initials(r.student_name) }}
                </div>
                <div class="rendu-info">
                  <span class="rendu-student">{{ r.student_name }}</span>
                  <span class="rendu-file">
                    {{ r.type === 'file' ? (r.file_name ?? r.content) : r.content }}
                  </span>
                </div>
                <span v-if="r.note" class="note-badge">{{ r.note }}</span>
                <span v-else class="rendu-no-note">Non noté</span>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.travaux-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  background: var(--bg-main);
}

.travaux-header {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 12px;
  border-bottom: 1px solid var(--border);
}

.travaux-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.travaux-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.travaux-view-toggle {
  display: flex;
  background: rgba(255,255,255,.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.view-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s, color .12s;
  font-family: var(--font);
}
.view-toggle-btn.active { background: var(--accent); color: #fff; }
.view-toggle-btn:hover:not(.active) { color: var(--text-primary); }

.travaux-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ── Liste commune ── */
.travaux-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 780px;
  margin: 0 auto;
}

/* ── Carte étudiant ── */
.travail-student-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  transition: border-color .15s;
}
.travail-student-card.submitted { border-color: rgba(39,174,96,.3); }
.travail-student-card:hover     { border-color: rgba(74,144,217,.3); }

.travail-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.travail-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.travail-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 2px 7px;
  border-radius: 4px;
}
.type-devoir { background: rgba(74,144,217,.2);  color: var(--accent); }
.type-projet { background: rgba(123,104,238,.2); color: #9b87f5; }
.type-jalon  { background: rgba(243,156,18,.2);  color: var(--color-warning); }

.travail-channel {
  font-size: 11px;
  color: var(--text-muted);
}

.travail-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.travail-card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}

.travail-submitted-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-success);
  margin-top: 8px;
}

.travail-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.travail-deadline-date {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── Formulaire de dépôt inline ── */
.deposit-form {
  background: rgba(255,255,255,.04);
  border: 1px solid var(--border-input);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deposit-tabs {
  display: flex;
  gap: 4px;
}

.deposit-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .12s;
  font-family: var(--font);
}
.deposit-tab.active  { background: var(--accent); color: #fff; border-color: var(--accent); }
.deposit-tab:hover:not(.active) { background: var(--bg-hover); color: var(--text-primary); }

.deposit-file-row,
.deposit-link-row { display: flex; gap: 8px; }

.deposit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Squelette carte travail */
.skel-travail-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Gantt ── */
.gantt-wrapper {
  max-width: 1000px;
  margin: 0 auto;
}

.gantt-legend {
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 700;
}

.gantt-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gantt-legend-item::before {
  content: '';
  width: 12px;
  height: 6px;
  border-radius: 3px;
  display: inline-block;
}
.gantt-legend-item.type-devoir::before { background: var(--accent); }
.gantt-legend-item.type-projet::before { background: #9b87f5; }
.gantt-legend-item.type-jalon::before  { background: var(--color-warning); }

.gantt-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gantt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background .12s;
}
.gantt-row:hover { background: rgba(255,255,255,.04); }

.gantt-row-label {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.gantt-label-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.gantt-track {
  flex: 1;
  height: 24px;
  background: rgba(255,255,255,.06);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.gantt-bar {
  position: absolute;
  top: 3px;
  height: 18px;
  border-radius: 5px;
  opacity: .85;
  transition: opacity .15s;
}
.gantt-bar:hover { opacity: 1; }
.gantt-bar.type-devoir { background: var(--accent); }
.gantt-bar.type-projet { background: #9b87f5; }
.gantt-bar.type-jalon  { background: var(--color-warning); }

/* ── Rendus groupés ── */
.rendus-group {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.rendus-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  background: rgba(255,255,255,.03);
  transition: background .12s;
}
.rendus-group-header:hover { background: rgba(255,255,255,.06); }

.rendus-group-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.rendus-count-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(74,144,217,.2);
  color: var(--accent);
}

.rendus-list {
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rendu-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255,255,255,.03);
}

.rendu-info {
  flex: 1;
  min-width: 0;
}

.rendu-student {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.rendu-file {
  display: block;
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rendu-no-note {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
