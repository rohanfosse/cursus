// Etat global de l'application — source de verite unique
export const state = {
  activeChannelId:    null,   // canal de chat actif
  activeDmStudentId:  null,   // etudiant DM actif
  activePromoId:      null,   // promo du contexte courant
  activeChannelType:  'chat', // 'chat' | 'annonce'
  rightPanel:         null,   // 'travaux' | 'profil' | null
  currentTravailId:   null,   // travail ouvert dans la modal depots/suivi
  pendingNoteDepotId: null,   // depot en attente de notation
  searchActive:       false,  // barre de recherche visible
};
