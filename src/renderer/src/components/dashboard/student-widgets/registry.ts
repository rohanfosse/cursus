/**
 * registry.ts - Registre des widgets du bento etudiant.
 * Chaque widget est decrit par un id unique, un label, une icone,
 * une description, une categorie, des tailles supportees et un etat par defaut.
 */
import type { WidgetDef } from '@/types/widgets'
import {
  Zap, FolderOpen, Award, FileText, Mic,
  MessageSquare, FileBox, Activity, ListChecks,
  Clock, Quote, CalendarDays, TrendingUp, Bookmark, Timer,
  Hourglass, Users, Flame, LayoutGrid, Lightbulb, NotebookPen, Target,
  Inbox, Sparkles, Keyboard,
} from 'lucide-vue-next'

// Re-export pour compatibilite (l'ancien WidgetDef venait d'ici)
export type { WidgetDef } from '@/types/widgets'

export const STUDENT_WIDGETS: WidgetDef[] = [
  // ── Widgets par defaut (v2.97 — dashboard simplifie) ──
  { id: 'echeances',     label: 'Echeances',           icon: ListChecks,    description: 'CCTLs, livrables et soutenances a venir',   category: 'essential',      sizes: ['2x1', '2x2', '4x1'],         defaultSize: '2x2', defaultEnabled: true,  role: 'student' },
  { id: 'project',       label: 'Projet en cours',     icon: FolderOpen,    description: 'Progression du projet actif',               category: 'tracking',       sizes: ['1x1', '2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: true,  role: 'student' },
  { id: 'lumenProgress', label: 'Reprendre la lecture', icon: TrendingUp,   description: 'Reprendre le dernier chapitre ouvert',      category: 'tracking',       sizes: ['1x1', '2x1'],                defaultSize: '1x1', defaultEnabled: true,  role: 'student' },
  { id: 'weekplanner',   label: 'Planning semaine',    icon: LayoutGrid,    description: 'Vue semaine avec deadlines et events',      category: 'essential',      sizes: ['2x1', '2x2', '4x1'],         defaultSize: '2x1', defaultEnabled: true,  role: 'student' },
  // ── Widgets optionnels ──
  { id: 'live',          label: 'Live',               icon: Zap,            description: 'Session interactive en cours',              category: 'essential',      sizes: ['2x1', '4x1'],                defaultSize: '2x1', defaultEnabled: true,  role: 'student' },
  { id: 'exams',         label: 'Prochaines epreuves', icon: Award,         description: 'CCTLs et etudes de cas a venir',            category: 'essential',      sizes: ['1x1', '2x1'],                defaultSize: '2x1', defaultEnabled: false, role: 'student' },
  { id: 'livrables',     label: 'Prochains livrables', icon: FileText,      description: 'Livrables a rendre',                        category: 'essential',      sizes: ['1x1', '2x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  { id: 'soutenances',   label: 'Soutenances',         icon: Mic,           description: 'Presentations a venir',                     category: 'essential',      sizes: ['1x1', '2x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  { id: 'feedback',      label: 'Dernier retour',      icon: MessageSquare, description: 'Dernier retour sur un devoir',              category: 'communication',  sizes: ['1x1', '2x1'],                defaultSize: '2x1', defaultEnabled: false, role: 'student' },
  { id: 'recentDoc',     label: 'Document recent',     icon: FileBox,       description: 'Dernier document partage',                  category: 'communication',  sizes: ['1x1', '2x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  { id: 'lumenCourses',  label: 'Nouveaux cours',      icon: Lightbulb,     description: 'Cours Lumen publies par vos enseignants',   category: 'communication',  sizes: ['1x1', '2x1'],                defaultSize: '2x1', defaultEnabled: false, role: 'student' },
  { id: 'lumenNotes',    label: 'Mes notes Lumen',     icon: NotebookPen,   description: 'Tes dernieres notes prises sur des cours',  category: 'productivity',   sizes: ['1x1', '2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: false, role: 'student' },
  { id: 'dailyGoal',     label: 'Objectif du jour',    icon: Target,        description: 'Ton objectif personnel du jour (reset quotidien)', category: 'productivity', sizes: ['1x1', '2x1'],             defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  { id: 'promoActivity', label: 'Activite promo',      icon: Activity,      description: 'Presence et rendus de la promo',            category: 'tracking',       sizes: ['2x1', '4x1'],                defaultSize: '2x1', defaultEnabled: false, role: 'student' },
  { id: 'streak',        label: 'Streak',              icon: Flame,         description: 'Jours consecutifs d\'activite',              category: 'tracking',       sizes: ['1x1'],                        defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  // ── Widgets optionnels (desactives par defaut) ──
  { id: 'clock',         label: 'Horloge',             icon: Clock,         description: 'Heure et date en temps reel',               category: 'fun',            sizes: ['1x1'],                        defaultSize: '1x1', defaultEnabled: false, role: 'both' },
  { id: 'quote',         label: 'Citation du jour',    icon: Quote,         description: 'Citation motivante quotidienne',            category: 'fun',            sizes: ['1x1', '2x1'],                defaultSize: '2x1', defaultEnabled: false, role: 'both' },
  { id: 'calendar',      label: 'Calendrier',          icon: CalendarDays,  description: 'Mini calendrier avec deadlines',            category: 'productivity',   sizes: ['2x1', '2x2'],                defaultSize: '2x1', defaultEnabled: false, role: 'student' },
  { id: 'progress',      label: 'Progression',         icon: TrendingUp,    description: 'Anneau de progression globale',             category: 'tracking',       sizes: ['1x1'],                        defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  { id: 'quicklinks',    label: 'Liens rapides',       icon: Bookmark,      description: 'Acces rapide a vos liens favoris',          category: 'productivity',   sizes: ['1x1', '2x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'both' },
  { id: 'pomodoro',      label: 'Pomodoro',            icon: Timer,         description: 'Minuteur de concentration 25/5',            category: 'productivity',   sizes: ['1x1'],                        defaultSize: '1x1', defaultEnabled: false, role: 'both' },
  { id: 'grades',        label: 'Mes notes',           icon: Award,         description: 'Dernieres notes recues',                    category: 'tracking',       sizes: ['1x1', '2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: false, role: 'student' },
  { id: 'bookmarks',     label: 'Sauvegardes',         icon: Bookmark,      description: 'Messages sauvegardes',                      category: 'communication',  sizes: ['1x1', '2x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'both' },
  { id: 'countdown',     label: 'Compte a rebours',    icon: Hourglass,     description: 'Temps restant avant la prochaine deadline', category: 'essential',      sizes: ['1x1'],                        defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  { id: 'group',         label: 'Mon groupe',          icon: Users,         description: 'Membres de votre groupe de projet',         category: 'tracking',       sizes: ['1x1', '2x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'student' },
  // ── Nouveaux widgets v2.165 ──
  { id: 'messages',      label: 'Messages',            icon: MessageSquare, description: 'DMs et mentions non lus',                  category: 'communication',  sizes: ['1x1', '2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: true,  role: 'student' },
  { id: 'rendus',        label: 'Rendus en attente',   icon: Inbox,         description: 'Devoirs rendus en attente de note',         category: 'tracking',       sizes: ['1x1', '2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: true,  role: 'student' },
  { id: 'actu',          label: 'Quoi de neuf',        icon: Sparkles,      description: 'Nouveautes Cursus',                         category: 'fun',            sizes: ['1x1', '2x1'],                defaultSize: '2x1', defaultEnabled: false, role: 'both' },
  // ── TypeRace (v2.170 — mini-jeu typing speed avec leaderboard promo) ──
  { id: 'typerace',      label: 'TypeRace',            icon: Keyboard,      description: 'Mini-jeu typing speed + classement du jour', category: 'fun',           sizes: ['2x1', '2x2'],                defaultSize: '2x1', defaultEnabled: false, role: 'both' },
]
