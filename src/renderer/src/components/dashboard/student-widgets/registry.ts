/**
 * registry.ts — Registre des widgets du bento étudiant.
 * Chaque widget est décrit par un id unique, un label, une icône,
 * une description et un état par défaut.
 */
import type { Component } from 'vue'
import {
  Radio, FolderOpen, Award, FileText, Mic, Hash, BookOpen,
  MessageSquare, FileBox, Activity,
} from 'lucide-vue-next'

export interface WidgetDef {
  id: string
  label: string
  icon: Component
  description: string
  defaultEnabled: boolean
}

export const STUDENT_WIDGETS: WidgetDef[] = [
  { id: 'live', label: 'Session Live', icon: Radio, description: 'Session interactive en cours', defaultEnabled: true },
  { id: 'project', label: 'Projet en cours', icon: FolderOpen, description: 'Progression du projet actif', defaultEnabled: true },
  { id: 'exams', label: 'Prochaines épreuves', icon: Award, description: 'CCTLs et études de cas à venir', defaultEnabled: true },
  { id: 'livrables', label: 'Prochains livrables', icon: FileText, description: 'Livrables à rendre', defaultEnabled: true },
  { id: 'soutenances', label: 'Soutenances', icon: Mic, description: 'Présentations à venir', defaultEnabled: true },
  { id: 'shortcuts', label: 'Conversations', icon: Hash, description: 'Accès rapide aux canaux récents', defaultEnabled: true },
  { id: 'actions', label: 'Raccourcis', icon: BookOpen, description: 'Liens rapides', defaultEnabled: true },
  { id: 'feedback', label: 'Dernier retour', icon: MessageSquare, description: 'Dernier retour sur un devoir', defaultEnabled: true },
  { id: 'recentDoc', label: 'Document récent', icon: FileBox, description: 'Dernier document partagé', defaultEnabled: true },
  { id: 'promoActivity', label: 'Activité promo', icon: Activity, description: 'Présence et rendus de la promo', defaultEnabled: true },
]
