/// <reference types="vite/client" />

import type {
  User, Promotion, Channel, Message, Devoir, Depot,
  AppDocument, Ressource, Group, Student, SendMessagePayload,
  Rubric, RubricScore,
} from './types'

// ─── Typage du pont IPC (window.api exposé par preload.ts) ──────────────────

interface IpcResponse<T> {
  ok: boolean
  data: T
  error?: string
}

declare global {
  interface Window {
    api: {
      // Structure
      getPromotions(): Promise<IpcResponse<Promotion[]>>
      getChannels(promoId: number): Promise<IpcResponse<Channel[]>>
      getStudents(promoId: number): Promise<IpcResponse<Student[]>>
      getAllStudents(): Promise<IpcResponse<Student[]>>

      // Messages
      getChannelMessages(channelId: number): Promise<IpcResponse<Message[]>>
      getDmMessages(studentId: number): Promise<IpcResponse<Message[]>>
      // Pagination par curseur — beforeId omis pour la première page
      getChannelMessagesPage(channelId: number, beforeId?: number | null): Promise<IpcResponse<Message[]>>
      getDmMessagesPage(studentId: number, beforeId?: number | null): Promise<IpcResponse<Message[]>>
      searchMessages(channelId: number, q: string): Promise<IpcResponse<Message[]>>
      sendMessage(payload: SendMessagePayload): Promise<IpcResponse<{ id: number }>>
      updateReactions(msgId: number, reactionsJson: string): Promise<IpcResponse<number>>

      // Travaux / Devoirs
      getTravaux(channelId: number): Promise<IpcResponse<Devoir[]>>
      getTravailById(travailId: number): Promise<IpcResponse<Devoir>>
      createTravail(payload: object): Promise<IpcResponse<{ id: number }>>
      getTravauxSuivi(travailId: number): Promise<IpcResponse<Depot[]>>

      // Dépôts
      getDepots(travailId: number): Promise<IpcResponse<Depot[]>>
      addDepot(payload: object): Promise<IpcResponse<{ id: number }>>
      setNote(payload: object): Promise<IpcResponse<null>>
      setFeedback(payload: object): Promise<IpcResponse<null>>

      // Groupes
      getGroups(promoId: number): Promise<IpcResponse<Group[]>>
      createGroup(payload: object): Promise<IpcResponse<{ id: number }>>
      deleteGroup(groupId: number): Promise<IpcResponse<null>>
      getGroupMembers(groupId: number): Promise<IpcResponse<{ student_id: number }[]>>
      setGroupMembers(payload: object): Promise<IpcResponse<null>>

      // Profil & devoirs étudiant
      getStudentProfile(studentId: number): Promise<IpcResponse<object>>
      getStudentTravaux(studentId: number): Promise<IpcResponse<Devoir[]>>

      // Ressources
      getRessources(travailId: number): Promise<IpcResponse<Ressource[]>>
      addRessource(payload: object): Promise<IpcResponse<{ id: number }>>
      deleteRessource(id: number): Promise<IpcResponse<null>>

      // Groupes par projet
      getTravailGroupMembers(travailId: number): Promise<IpcResponse<object[]>>
      setTravailGroupMember(payload: object): Promise<IpcResponse<null>>

      // Brouillon
      updateTravailPublished(payload: object): Promise<IpcResponse<null>>

      // Promotions & canaux
      createPromotion(payload: object): Promise<IpcResponse<{ id: number }>>
      deletePromotion(promoId: number): Promise<IpcResponse<null>>
      createChannel(payload: object): Promise<IpcResponse<{ id: number }>>
      renameChannel(id: number, name: string): Promise<IpcResponse<null>>
      deleteChannel(id: number): Promise<IpcResponse<null>>
      renameCategory(promoId: number, oldCategory: string, newCategory: string): Promise<IpcResponse<null>>
      deleteCategory(promoId: number, category: string): Promise<IpcResponse<null>>

      // Inscription
      getStudentByEmail(email: string): Promise<IpcResponse<Student>>
      registerStudent(payload: object): Promise<IpcResponse<{ id: number }>>
      importStudents(promoId: number): Promise<IpcResponse<{ imported: number; errors: string[] } | null>>

      // Identité / login
      getIdentities(): Promise<IpcResponse<Student[]>>
      loginWithCredentials(email: string, password: string): Promise<IpcResponse<User>>

      // Shell
      openPath(filePath: string): Promise<IpcResponse<null>>
      openExternal(url: string): Promise<IpcResponse<null>>

      // Fichiers & export
      openImageDialog(): Promise<IpcResponse<string | null>>
      openFileDialog(): Promise<IpcResponse<string | null>>
      exportCsv(travailId: number): Promise<IpcResponse<string | null>>

      // Données prof
      getTeacherSchedule(): Promise<IpcResponse<object>>
      getTravailCategories(promoId: number): Promise<IpcResponse<string[]>>
      getGanttData(promoId: number): Promise<IpcResponse<object[]>>
      getAllRendus(promoId: number): Promise<IpcResponse<Depot[]>>

      // PDF
      openPdf(filePath: string): Promise<IpcResponse<null>>

      // Documents
      getChannelDocuments(channelId: number): Promise<IpcResponse<AppDocument[]>>
      getPromoDocuments(promoId: number): Promise<IpcResponse<AppDocument[]>>
      addChannelDocument(payload: object): Promise<IpcResponse<{ id: number }>>
      deleteChannelDocument(id: number): Promise<IpcResponse<null>>
      getChannelDocumentCategories(channelId: number): Promise<IpcResponse<string[]>>

      // Documents de projet (nouveau)
      getProjectDocuments(promoId: number, project?: string | null): Promise<IpcResponse<AppDocument[]>>
      addProjectDocument(payload: object): Promise<IpcResponse<{ id: number }>>
      getProjectDocumentCategories(promoId: number, project?: string | null): Promise<IpcResponse<string[]>>

      // Messages épinglés
      getPinnedMessages(channelId: number): Promise<IpcResponse<Message[]>>
      togglePinMessage(payload: { messageId: number; pinned: boolean }): Promise<IpcResponse<null>>
      deleteMessage(id: number): Promise<IpcResponse<number>>
      editMessage(id: number, content: string): Promise<IpcResponse<number>>

      // Rubrics
      getRubric(travailId: number): Promise<IpcResponse<Rubric | null>>
      upsertRubric(payload: object): Promise<IpcResponse<number>>
      deleteRubric(travailId: number): Promise<IpcResponse<null>>
      getDepotScores(depotId: number): Promise<IpcResponse<RubricScore[]>>
      setDepotScores(payload: object): Promise<IpcResponse<null>>

      // Actions de masse
      markNonSubmittedAsD(travailId: number): Promise<IpcResponse<null>>

      // Fichiers
      readFileBase64(filePath: string): Promise<IpcResponse<{ mime: string; b64: string; ext: string }>>
      downloadFile(filePath: string): Promise<IpcResponse<null>>

      // Données de démo
      resetAndSeed(): Promise<IpcResponse<null>>

      // Temps réel — push du Main process
      onNewMessage(cb: (data: {
        channelId:       number | null
        dmStudentId:     number | null
        authorName:      string | null
        mentionEveryone: boolean
        mentionNames:    string[]
      }) => void): () => void
    }
  }
}
