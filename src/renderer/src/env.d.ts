/// <reference types="vite/client" />

import type {
  User, Promotion, Channel, Message, Devoir, Depot,
  AppDocument, Ressource, Group, Student, SendMessagePayload,
  Rubric, RubricScore, LiveSession, LiveActivity, LiveResults,
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
      // Auth / session
      setToken(token: string): void

      // Structure
      getPromotions(): Promise<IpcResponse<Promotion[]>>
      getChannels(promoId: number): Promise<IpcResponse<Channel[]>>
      getStudents(promoId: number): Promise<IpcResponse<Student[]>>
      getAllStudents(): Promise<IpcResponse<Student[]>>

      // Messages — pagination par curseur (beforeId omis pour la première page)
      getChannelMessagesPage(channelId: number, beforeId?: number | null): Promise<IpcResponse<Message[]>>
      getDmMessagesPage(studentId: number, beforeId?: number | null, peer?: number | null): Promise<IpcResponse<Message[]>>
      findUserByName(name: string): Promise<IpcResponse<{ id: number; name: string; promo_id: number | null; avatar_initials: string; photo_data: string | null; type: string } | null>>
      getTeachers(): Promise<IpcResponse<Student[]>>
      getRecentDmContacts(studentId: number, limit?: number): Promise<IpcResponse<{ name: string; last_message_at: string; last_message_preview: string }[]>>
      searchMessages(channelId: number, q: string): Promise<IpcResponse<Message[]>>
      searchDmMessages(studentId: number, q: string, peer?: number): Promise<IpcResponse<Message[]>>
      searchAllMessages(args: { promoId: number | null; query: string; limit?: number }): Promise<IpcResponse<{ id: number; content: string; author_name: string; created_at: string; channel_id: number; channel_name: string; promo_id: number }[]>>
      sendMessage(payload: SendMessagePayload): Promise<IpcResponse<Message>>
      updateReactions(msgId: number, reactionsJson: string): Promise<IpcResponse<number>>

      // Travaux / Devoirs
      getTravaux(channelId: number): Promise<IpcResponse<Devoir[]>>
      getTravailById(travailId: number): Promise<IpcResponse<Devoir>>
      createTravail(payload: object): Promise<IpcResponse<{ id: number }>>
      deleteTravail(id: number): Promise<IpcResponse<null>>
      getTravauxSuivi(travailId: number): Promise<IpcResponse<Depot[]>>

      // Dépôts
      getDepots(travailId: number): Promise<IpcResponse<Depot[]>>
      addDepot(payload: object): Promise<IpcResponse<{ id: number }>>
      setNote(payload: object): Promise<IpcResponse<null>>
      setFeedback(payload: object): Promise<IpcResponse<null>>

      // Groupes
      getGroups(promoId: number): Promise<IpcResponse<Group[]>>
      createGroup(payload: object): Promise<IpcResponse<{ id: number }>>
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

      // Brouillon
      updateTravailPublished(payload: object): Promise<IpcResponse<null>>

      // Promotions & canaux
      createPromotion(payload: object): Promise<IpcResponse<{ id: number }>>
      deletePromotion(promoId: number): Promise<IpcResponse<null>>
      renamePromotion(promoId: number, name: string, color?: string): Promise<IpcResponse<null>>
      createChannel(payload: object): Promise<IpcResponse<{ id: number }>>
      renameChannel(id: number, name: string): Promise<IpcResponse<null>>
      deleteChannel(id: number): Promise<IpcResponse<null>>
      renameCategory(promoId: number, oldCategory: string, newCategory: string): Promise<IpcResponse<null>>
      deleteCategory(promoId: number, category: string): Promise<IpcResponse<null>>
      updateChannelMembers(payload: object): Promise<IpcResponse<null>>
      updateChannelCategory(channelId: number, category: string | null): Promise<IpcResponse<null>>

      // Inscription
      getStudentByEmail(email: string): Promise<IpcResponse<Student>>
      registerStudent(payload: object): Promise<IpcResponse<{ id: number }>>
      importStudents(promoId: number): Promise<IpcResponse<{ imported: number; errors: string[] } | null>>
      bulkImportStudents(promoId: number, rows: Record<string, string>[]): Promise<IpcResponse<{ imported: number; errors: string[] }>>

      // Identité / login
      getIdentities(): Promise<IpcResponse<Student[]>>
      loginWithCredentials(email: string, password: string): Promise<IpcResponse<User>>
      changePassword(userId: number, isTeacher: boolean, currentPwd: string, newPwd: string): Promise<IpcResponse<null>>
      exportPersonalData(studentId: number): Promise<IpcResponse<object>>

      // Upload fichier vers le serveur → URL publique
      uploadFile(localPath: string): Promise<IpcResponse<string>>

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
      getGanttData(promoId: number, channelId?: number): Promise<IpcResponse<object[]>>
      getAllRendus(promoId: number): Promise<IpcResponse<Depot[]>>

      // Documents
      getChannelDocuments(channelId: number): Promise<IpcResponse<AppDocument[]>>
      addChannelDocument(payload: object): Promise<IpcResponse<{ id: number }>>
      deleteChannelDocument(id: number): Promise<IpcResponse<null>>

      // Documents de projet
      getProjectDocuments(promoId: number, project?: string | null): Promise<IpcResponse<AppDocument[]>>
      addProjectDocument(payload: object): Promise<IpcResponse<{ id: number }>>

      // Messages épinglés
      getPinnedMessages(channelId: number): Promise<IpcResponse<Message[]>>
      togglePinMessage(payload: { messageId: number; pinned: boolean }): Promise<IpcResponse<number>>
      deleteMessage(id: number): Promise<IpcResponse<number>>
      reportMessage(messageId: number, reason: string): Promise<IpcResponse<null>>
      getTeacherReminders(): Promise<IpcResponse<{ id: number; promo_tag: string; date: string; title: string; description: string; bloc: string | null; done: number }[]>>
      toggleReminderDone(id: number, done: boolean): Promise<IpcResponse<null>>
      submitFeedback(type: string, title: string, description: string): Promise<IpcResponse<{ id: number }>>
      getMyFeedback(): Promise<IpcResponse<{ id: number; type: string; title: string; description: string; status: string; admin_reply: string | null; created_at: string }[]>>
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

      // Intervenants
      getIntervenants(): Promise<IpcResponse<{ id: number; name: string; email: string; role: string }[]>>
      createIntervenant(payload: object): Promise<IpcResponse<number>>
      deleteIntervenant(id: number): Promise<IpcResponse<null>>
      getTeacherChannels(id: number): Promise<IpcResponse<number[]>>
      setTeacherChannels(payload: { teacherId: number; channelIds: number[] }): Promise<IpcResponse<null>>

      // Contrôles de fenêtre
      windowMinimize(): Promise<IpcResponse<null>>
      windowMaximize(): Promise<IpcResponse<null>>
      windowClose(): Promise<IpcResponse<null>>
      windowIsMaximized(): Promise<IpcResponse<boolean>>
      onMaximizeChange(cb: (maximized: boolean) => void): () => void
      platform: string

      // Temps réel - push du Main process
      onNewMessage(cb: (data: {
        channelId:       number | null
        dmStudentId:     number | null
        authorName:      string | null
        channelName:     string | null
        promoId:         number | null
        preview:         string | null
        mentionEveryone: boolean
        mentionNames:    string[]
      }) => void): () => void
      onSocketStateChange(cb: (connected: boolean) => void): () => void
      onPresenceUpdate?(cb: (data: { id: number; name: string; role: string }[]) => void): () => void
      emitTyping?(channelId: number): void
      emitDmTyping?(dmStudentId: number): void
      onTyping?(cb: (data: { channelId: number; userName: string }) => void): () => void
      getClasseStats(promoId: number): Promise<IpcResponse<{
        id: number; name: string; avatar_initials: string; photo_data: string | null
        submitted_count: number; total_count: number; graded_count: number; avg_grade: number | null
        last_message_at: string | null
      }[]>>
      updateStudentPhoto(payload: { studentId: number; photoData: string | null }): Promise<IpcResponse<number>>
      updateTeacherPhoto(payload: { teacherId: number; photoData: string | null }): Promise<IpcResponse<number>>

      // Live Quiz
      createLiveSession(payload: unknown): Promise<IpcResponse<LiveSession>>
      getLiveSession(id: number): Promise<IpcResponse<LiveSession>>
      getLiveSessionByCode(code: string): Promise<IpcResponse<LiveSession>>
      getActiveLiveSession(promoId: number): Promise<IpcResponse<LiveSession>>
      updateLiveSessionStatus(id: number, status: string): Promise<IpcResponse<LiveSession>>
      addLiveActivity(sessionId: number, payload: unknown): Promise<IpcResponse<LiveActivity>>
      deleteLiveActivity(id: number): Promise<IpcResponse<null>>
      setLiveActivityStatus(id: number, status: string): Promise<IpcResponse<LiveActivity>>
      submitLiveResponse(activityId: number, payload: unknown): Promise<IpcResponse<null>>
      getLiveActivityResults(activityId: number): Promise<IpcResponse<LiveResults>>
      emitLiveJoin(promoId: number): void
      emitLiveLeave(promoId: number): void
      onLiveActivityPushed(cb: (data: { activity: unknown }) => void): () => void
      onLiveActivityClosed(cb: (data: { activityId: number }) => void): () => void
      onLiveResultsUpdate(cb: (data: { activityId: number; data: unknown }) => void): () => void
      onLiveSessionStarted(cb: (data: { sessionId: number }) => void): () => void
      onLiveSessionEnded(cb: (data: { sessionId: number }) => void): () => void
      onLiveInvite(cb: (data: { sessionId: number; title: string; joinCode: string; teacherName: string }) => void): () => void

      // Grade notifications
      onGradeNew(cb: (data: { devoirTitle: string; note: string | null; feedback: string | null; devoirId: number; category: string | null }) => void): () => void
    }
  }
}
