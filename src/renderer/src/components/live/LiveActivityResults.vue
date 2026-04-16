<!--
  LiveActivityResults — commutateur unifie des composants de resultats.
  Rendu identique dans la vue classique ET en mode projection. Toute nouvelle
  activite se declare ici une seule fois.
-->
<script setup lang="ts">
import type { LiveActivity, LiveResults } from '@/types'
import QcmResults           from './QcmResults.vue'
import PollResults          from './PollResults.vue'
import AssociationResults   from './AssociationResults.vue'
import EstimationResults    from './EstimationResults.vue'
import RexQuestionOuverteResults from '@/components/rex/RexQuestionOuverteResults.vue'
import RexSondageResults        from '@/components/rex/RexSondageResults.vue'
import RexEchelleResults        from '@/components/rex/RexEchelleResults.vue'
import RexWordCloud             from '@/components/rex/RexWordCloud.vue'
import RexHumeurResults         from '@/components/rex/RexHumeurResults.vue'
import RexPrioriteResults       from '@/components/rex/RexPrioriteResults.vue'
import RexMatriceResults        from '@/components/rex/RexMatriceResults.vue'

defineProps<{
  activity: LiveActivity
  results: LiveResults | null
  /** Counts normalises pour RexSondageResults (deja calcules par le parent). */
  pulseSondageCounts: { text: string; count: number }[]
}>()
</script>

<template>
  <!-- Spark -->
  <QcmResults
    v-if="(activity.type === 'qcm' || activity.type === 'vrai_faux') && results"
    :results="results"
    :activity="activity"
  />
  <PollResults
    v-else-if="activity.type === 'reponse_courte' && results"
    :results="results"
  />
  <AssociationResults
    v-else-if="activity.type === 'association' && results"
    :results="results"
  />
  <EstimationResults
    v-else-if="activity.type === 'estimation' && results"
    :results="results"
  />
  <!-- Pulse -->
  <RexQuestionOuverteResults
    v-else-if="activity.type === 'question_ouverte' && results?.answers"
    :answers="results.answers"
    :is-teacher="true"
  />
  <RexSondageResults
    v-else-if="(activity.type === 'sondage' || activity.type === 'sondage_libre') && pulseSondageCounts.length"
    :results="pulseSondageCounts"
    :total="results?.total ?? 0"
  />
  <RexEchelleResults
    v-else-if="activity.type === 'echelle' && results?.average !== undefined"
    :average="results.average"
    :max-rating="activity.max_rating ?? 5"
    :distribution="results.distribution ?? []"
    :total="results.total ?? 0"
  />
  <RexWordCloud
    v-else-if="activity.type === 'nuage' && results?.freq"
    :words="results.freq"
  />
  <RexHumeurResults
    v-else-if="activity.type === 'humeur' && results?.emojis"
    :emojis="results.emojis"
    :total="results.total ?? 0"
  />
  <RexPrioriteResults
    v-else-if="activity.type === 'priorite' && results?.rankings"
    :rankings="results.rankings"
    :total="results.total ?? 0"
  />
  <RexMatriceResults
    v-else-if="activity.type === 'matrice' && results?.criteria"
    :criteria="results.criteria"
    :max-rating="activity.max_rating ?? 5"
    :total="results.total ?? 0"
  />
  <slot v-else name="empty">
    <!-- Fallback : laisse le parent decider du rendu "en attente" -->
  </slot>
</template>
