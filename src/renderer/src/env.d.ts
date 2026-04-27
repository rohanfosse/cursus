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
      // Badge barre des taches (Windows)
      setBadge(): void
      clearBadge(): void

      // Auth / session
      setToken(token: string): void
      clearAuth(): void
      refreshToken(): Promise<{ token: string } | null>

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
      searchDmMessages(studentId: number, q: string, peer?: number): Promise<IpcResponse<{ results: Message[]; truncated: boolean }>>
      searchAllMessages(args: { promoId: number | null; query: string; limit?: number; userId?: number | null }): Promise<IpcResponse<{ id: number; content: string; author_name: string; created_at: string; channel_id: number; channel_name: string; promo_id: number; source_type?: string }[]>>
      sendMessage(payload: SendMessagePayload): Promise<IpcResponse<Message>>
      updateReactions(msgId: number, reactionsJson: string): Promise<IpcResponse<number>>
      voteOnPoll(messageId: number, options: number[]): Promise<IpcResponse<{ totals: number[]; voters: Record<string, number[]> }>>

      // Travaux / Devoirs
      getTravaux(channelId: number): Promise<IpcResponse<Devoir[]>>
      getTravailById(travailId: number): Promise<IpcResponse<Devoir>>
      createTravail(payload: Record<string, unknown> & { title: string }): Promise<IpcResponse<{ id: number }>>
      deleteTravail(id: number): Promise<IpcResponse<null>>
      getTravauxSuivi(travailId: number): Promise<IpcResponse<Depot[]>>

      // Dépôts
      getDepots(travailId: number): Promise<IpcResponse<Depot[]>>
      addDepot(payload: Record<string, unknown>): Promise<IpcResponse<{ id: number }>>
      setNote(payload: { depotId: number; note: string | null }): Promise<IpcResponse<null>>
      setFeedback(payload: { depotId: number; feedback: string | null }): Promise<IpcResponse<null>>

      // Groupes
      getGroups(promoId: number): Promise<IpcResponse<Group[]>>
      createGroup(payload: Record<string, unknown> & { name: string }): Promise<IpcResponse<{ id: number }>>
      getGroupMembers(groupId: number): Promise<IpcResponse<{ student_id: number }[]>>
      setGroupMembers(payload: Record<string, unknown> & { groupId: number }): Promise<IpcResponse<null>>

      // Profil & devoirs étudiant
      getStudentProfile(studentId: number): Promise<IpcResponse<{ student: { id: number; name: string; email: string; avatar_initials: string; photo_data: string | null; promo_name: string }; travaux: unknown[] }>>
      getStudentTravaux(studentId: number): Promise<IpcResponse<Devoir[]>>

      // Ressources
      getRessources(travailId: number): Promise<IpcResponse<Ressource[]>>
      addRessource(payload: Record<string, unknown> & { travailId: number; name: string }): Promise<IpcResponse<{ id: number }>>
      deleteRessource(id: number): Promise<IpcResponse<null>>

      // Groupes par projet
      getTravailGroupMembers(travailId: number): Promise<IpcResponse<unknown[]>>

      // Brouillon / publication programmee
      updateTravailPublished(payload: Record<string, unknown> & { travailId: number; published: boolean }): Promise<IpcResponse<null>>
      updateTravailScheduled(payload: { travailId: number; scheduledAt: string | null }): Promise<IpcResponse<null>>
      updateTravail(id: number, payload: Partial<{ title: string; deadline: string; description: string; room: string; scheduledPublishAt: string | null; requires_submission: 0 | 1 }>): Promise<IpcResponse<null>>

      // Promotions & canaux
      createPromotion(payload: Record<string, unknown> & { name: string }): Promise<IpcResponse<{ id: number }>>
      deletePromotion(promoId: number): Promise<IpcResponse<null>>
      renamePromotion(promoId: number, name: string, color?: string): Promise<IpcResponse<null>>
      createChannel(payload: Record<string, unknown> & { name: string }): Promise<IpcResponse<{ id: number }>>
      renameChannel(id: number, name: string): Promise<IpcResponse<null>>
      deleteChannel(id: number): Promise<IpcResponse<null>>
      archiveChannel(id: number): Promise<IpcResponse<null>>
      restoreChannel(id: number): Promise<IpcResponse<null>>
      getArchivedChannels(promoId: number): Promise<IpcResponse<Channel[]>>
      renameCategory(promoId: number, oldCategory: string, newCategory: string): Promise<IpcResponse<null>>
      deleteCategory(promoId: number, category: string): Promise<IpcResponse<null>>
      updateChannelMembers(payload: Record<string, unknown> & { channelId: number }): Promise<IpcResponse<null>>
      updateChannelCategory(channelId: number, category: string | null): Promise<IpcResponse<null>>
      updateChannelPrivacy(channelId: number, isPrivate: boolean, members?: number[]): Promise<IpcResponse<unknown>>

      // Inscription
      getStudentByEmail(email: string): Promise<IpcResponse<Student>>
      registerStudent(payload: Record<string, unknown> & { name: string; email: string }): Promise<IpcResponse<{ id: number }>>
      importStudents(promoId: number, path?: string): Promise<IpcResponse<{ imported: number; errors: string[] } | null>>
      bulkImportStudents(promoId: number, rows: Record<string, string>[]): Promise<IpcResponse<{ imported: number; errors: string[] }>>

      // Identité / login
      getIdentities(): Promise<IpcResponse<Student[]>>
      loginWithCredentials(email: string, password: string): Promise<IpcResponse<User>>
      changePassword(userId: number, isTeacher: boolean, currentPwd: string, newPwd: string): Promise<IpcResponse<null>>
      exportPersonalData(studentId: number): Promise<IpcResponse<object>>

      // Upload fichier vers le serveur → URL publique + taille
      // onProgress optionnel : callback appele avec pourcentage 0-100 pendant l'upload
      uploadFile(localPath: string, onProgress?: (percent: number) => void): Promise<IpcResponse<{ url: string; file_size?: number }>>

      // Shell
      openPath(filePath: string): Promise<IpcResponse<null>>
      openExternal(url: string): Promise<IpcResponse<null>>

      // Fichiers & export
      openImageDialog(): Promise<IpcResponse<string | null>>
      openFileDialog(): Promise<IpcResponse<string[] | null>>
      exportCsv(travailId: number): Promise<IpcResponse<string | null>>

      // Données prof
      getTeacherSchedule(): Promise<IpcResponse<object>>
      getTravailCategories(promoId: number): Promise<IpcResponse<string[]>>
      getGanttData(promoId: number, channelId?: number): Promise<IpcResponse<object[]>>
      getAllRendus(promoId: number): Promise<IpcResponse<Depot[]>>

      // Documents
      getChannelDocuments(channelId: number): Promise<IpcResponse<AppDocument[]>>
      addChannelDocument(payload: Record<string, unknown> & { channelId: number; name: string }): Promise<IpcResponse<{ id: number }>>
      deleteChannelDocument(id: number): Promise<IpcResponse<null>>

      // Documents de projet
      getProjectDocuments(promoId: number, project?: string | null): Promise<IpcResponse<AppDocument[]>>
      addProjectDocument(payload: Record<string, unknown> & { name: string }): Promise<IpcResponse<{ id: number }>>
      updateProjectDocument(id: number, payload: Record<string, unknown>): Promise<IpcResponse<unknown>>
      searchDocuments(promoId: number, q: string): Promise<IpcResponse<AppDocument[]>>
      linkDocumentToTravail(docId: number, travailId: number | null): Promise<IpcResponse<unknown>>

      // Cahiers (notebooks collaboratifs)
      getCahiers(promoId: number, project?: string | null): Promise<IpcResponse<import('./stores/cahier').Cahier[]>>
      getCahierById(id: number): Promise<IpcResponse<import('./stores/cahier').Cahier>>
      getCahierYjsState(id: number): Promise<IpcResponse<string | null>>
      saveCahierYjsState(id: number, base64State: string): Promise<IpcResponse<unknown>>
      createCahier(payload: Record<string, unknown> & { promoId: number; title: string }): Promise<IpcResponse<{ id: number }>>
      renameCahier(id: number, title: string): Promise<IpcResponse<unknown>>
      deleteCahier(id: number): Promise<IpcResponse<unknown>>

      // Messages épinglés
      getPinnedMessages(channelId: number): Promise<IpcResponse<Message[]>>
      togglePinMessage(payload: { messageId: number; pinned: boolean }): Promise<IpcResponse<number>>
      deleteMessage(id: number): Promise<IpcResponse<number>>
      reportMessage(messageId: number, reason: string): Promise<IpcResponse<null>>

      // Messages programmes
      listScheduledMessages(): Promise<IpcResponse<Array<{
        id: number
        channel_id: number | null
        channel_name: string | null
        channel_promo_id: number | null
        dm_student_id: number | null
        dm_peer_id: number | null
        dm_peer_name: string | null
        author_id: number
        author_name: string
        author_type: 'student' | 'teacher'
        content: string
        reply_to_id: number | null
        reply_to_author: string | null
        reply_to_preview: string | null
        attachments_json: string | null
        send_at: string
        sent: number
        failed_at: string | null
        error: string | null
        created_at: string
      }>>>
      createScheduledMessage(payload: {
        channelId?: number | null
        dmStudentId?: number | null
        dmPeerId?: number | null
        content: string
        sendAt: string
        replyToId?: number | null
        replyToAuthor?: string | null
        replyToPreview?: string | null
        attachments?: unknown
      }): Promise<IpcResponse<{ id: number }>>
      updateScheduledMessage(id: number, payload: { content?: string; sendAt?: string }): Promise<IpcResponse<{ updated: number }>>
      deleteScheduledMessage(id: number): Promise<IpcResponse<{ removed: number }>>

      // Signets (bookmarks)
      listBookmarks(beforeId?: number | null, limit?: number | null): Promise<IpcResponse<Array<{
        bookmark_id: number
        bookmark_note: string | null
        bookmarked_at: string
        id: number
        channel_id: number | null
        dm_student_id: number | null
        author_id: number
        author_name: string
        author_type: 'student' | 'teacher'
        author_initials: string
        author_photo: string | null
        content: string
        created_at: string
        edited: number
        is_pinned: number
        reply_to_author: string | null
        reply_to_preview: string | null
        channel_name: string | null
        dm_peer_name: string | null
      }>>>
      listBookmarkIds(): Promise<IpcResponse<{ ids: number[]; count: number }>>
      addBookmark(messageId: number, note?: string | null): Promise<IpcResponse<{ messageId: number; note: string | null }>>
      removeBookmark(messageId: number): Promise<IpcResponse<{ removed: number }>>
      importBookmarks(messageIds: number[]): Promise<IpcResponse<{ inserted: number }>>
      getTeacherReminders(): Promise<IpcResponse<{ id: number; promo_tag: string; date: string; title: string; description: string; bloc: string | null; done: number }[]>>
      toggleReminderDone(id: number, done: boolean): Promise<IpcResponse<null>>
      submitFeedback(type: string, title: string, description: string): Promise<IpcResponse<{ id: number }>>
      getMyFeedback(): Promise<IpcResponse<{ id: number; type: string; title: string; description: string; status: string; admin_reply: string | null; created_at: string }[]>>
      editMessage(id: number, content: string): Promise<IpcResponse<number>>

      // Rubrics
      getRubric(travailId: number): Promise<IpcResponse<Rubric | null>>
      upsertRubric(payload: Record<string, unknown> & { travailId: number }): Promise<IpcResponse<number>>
      deleteRubric(travailId: number): Promise<IpcResponse<null>>
      getDepotScores(depotId: number): Promise<IpcResponse<RubricScore[]>>
      setDepotScores(payload: Record<string, unknown> & { depotId: number }): Promise<IpcResponse<null>>

      // Actions de masse
      markNonSubmittedAsD(travailId: number): Promise<IpcResponse<null>>

      // Fichiers
      readFileBase64(filePath: string): Promise<IpcResponse<{ mime: string; b64: string; ext: string }>>
      downloadFile(filePath: string): Promise<IpcResponse<null>>

      // Données de démo
      resetAndSeed(): Promise<IpcResponse<null>>

      // Admin — Users (parite + bulk actions)
      adminGetUsers(params?: { search?: string; promo_id?: number | null; type?: string | null; page?: number; limit?: number }): Promise<IpcResponse<{
        users: Array<{ id: number; name: string; email: string; type: 'student' | 'teacher' | 'ta' | 'admin'; promo_id: number | null; promo_name: string | null; promo_color: string | null; avatar_initials: string; photo_data: string | null; must_change_password: number }>
        total: number; page: number; limit: number
      }>>
      adminGetUserDetail(id: number): Promise<IpcResponse<{
        id: number; name: string; email: string; type: 'student' | 'teacher' | 'ta' | 'admin'; avatar_initials: string; photo_data: string | null
        promo_id: number | null; promo_name: string | null
        messageCount: number; lastMessageAt: string | null; depotCount: number
      }>>
      adminUpdateUser(id: number, payload: { name?: string; email?: string; promo_id?: number | null }): Promise<IpcResponse<null>>
      adminResetPassword(id: number): Promise<IpcResponse<{ tempPassword: string }>>
      adminDeleteUser(id: number): Promise<IpcResponse<null>>

      // Admin — Roles & promos
      adminSetTeacherRole(id: number, role: 'teacher' | 'ta' | 'admin'): Promise<IpcResponse<{ id: number; role: 'teacher' | 'ta' | 'admin' }>>
      adminGetTeacherPromos(id: number): Promise<IpcResponse<Array<{ id: number; name: string; color: string }>>>
      adminAssignPromo(id: number, promoId: number): Promise<IpcResponse<{ teacherId: number; promoId: number }>>
      adminUnassignPromo(id: number, promoId: number): Promise<IpcResponse<null>>

      // Admin — Stats
      adminGetStats(): Promise<IpcResponse<{
        counts: { students: number; teachers: number; promotions: number; channels: number; messages: number; travaux: number; depots: number }
        activity24h: { messages_24h: number; depots_24h: number }
        messagesPerDay: Array<{ day: string; count: number }>
        depotsPerDay: Array<{ day: string; count: number }>
        topChannels: Array<{ name: string; promo_name: string; message_count: number }>
        gradeDistribution: Array<{ range: string; count: number }>
        lateCount: number; ungradedCount: number; avgGrade: number | null
        promosSummary: Array<{ id: number; name: string; color: string; archived: number; student_count: number; channel_count: number; travaux_count: number; avg_grade: number | null }>
      }>>
      adminGetHeatmap(): Promise<IpcResponse<Array<{ day_of_week: number; hour: number; count: number }>>>
      adminGetAdoption(): Promise<IpcResponse<{
        dau: number; wau: number; mau: number; totalStudents: number
        dauTrend: Array<{ day: string; count: number }>
      }>>
      adminGetLastSeen(): Promise<IpcResponse<Array<{ id: number; name: string; email: string; promo_id: number | null; promo_name: string | null; last_seen: string | null; days_absent: number | null }>>>
      adminGetInactive(days: number): Promise<IpcResponse<Array<{ id: number; name: string; email: string; promo_id: number | null; promo_name: string | null; last_seen: string | null }>>>

      // Intervenants
      getIntervenants(): Promise<IpcResponse<{ id: number; name: string; email: string; role: string }[]>>
      createIntervenant(payload: Record<string, unknown> & { name: string; email: string }): Promise<IpcResponse<number>>
      deleteIntervenant(id: number): Promise<IpcResponse<null>>
      getTeacherChannels(id: number): Promise<IpcResponse<number[]>>
      setTeacherChannels(payload: { teacherId: number; channelIds: number[] }): Promise<IpcResponse<null>>

      // Projets (entite backend)
      getProjectsByPromo(promoId: number): Promise<IpcResponse<unknown[]>>
      getProjectById(id: number): Promise<IpcResponse<unknown>>
      createProject(payload: Record<string, unknown> & { promoId: number; name: string }): Promise<IpcResponse<unknown>>
      updateProject(id: number, payload: Record<string, unknown>): Promise<IpcResponse<unknown>>
      deleteProject(id: number): Promise<IpcResponse<null>>
      addTravailToProject(projectId: number, travailId: number): Promise<IpcResponse<null>>
      removeTravailFromProject(projectId: number, travailId: number): Promise<IpcResponse<null>>
      getProjectTravaux(projectId: number): Promise<IpcResponse<unknown[]>>
      getProjectDocs(projectId: number): Promise<IpcResponse<unknown[]>>
      assignTaToProject(teacherId: number, projectId: number): Promise<IpcResponse<null>>
      unassignTaFromProject(teacherId: number, projectId: number): Promise<IpcResponse<null>>
      getProjectTas(projectId: number): Promise<IpcResponse<unknown[]>>
      getTaProjects(teacherId: number): Promise<IpcResponse<unknown[]>>

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
        message?:        unknown
      }) => void): () => void
      onSocketStateChange(cb: (connected: boolean) => void): () => void
      onAuthExpired(cb: () => void): () => void
      onPollUpdate?(cb: (data: { messageId: number; poll_votes: { totals: number[]; voters: Record<string, number[]> } }) => void): () => void
      onPresenceUpdate?(cb: (data: Array<{ id: number; name: string; role: string; status?: { emoji: string | null; text: string | null; expiresAt: string | null } | null }>) => void): () => void

      // Link preview (unfurl)
      resolveLinkPreviews(urls: string[]): Promise<IpcResponse<Array<{
        url: string
        title: string | null
        description: string | null
        image: string | null
        site_name: string | null
        status: number
      }>>>
      linkPreviewImageUrl(url: string): string

      // Statuts personnalises
      getMyStatus(): Promise<IpcResponse<{ userId: number; emoji: string | null; text: string | null; expiresAt: string | null; updatedAt: string } | null>>
      setMyStatus(payload: { emoji: string | null; text: string | null; expiresAt: string | null }): Promise<IpcResponse<{ userId: number; emoji: string | null; text: string | null; expiresAt: string | null; updatedAt: string } | null>>
      clearMyStatus(): Promise<IpcResponse<{ cleared: boolean }>>
      listUserStatuses(): Promise<IpcResponse<Array<{ userId: number; emoji: string | null; text: string | null; expiresAt: string | null }>>>
      onStatusChange(cb: (data: { userId: number; status: { emoji: string | null; text: string | null; expiresAt: string | null } | null }) => void): () => void
      emitTyping?(channelId: number): void
      emitDmTyping?(dmStudentId: number, dmPeerId?: number): void
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
      submitLiveResponse(activityId: number, payload: unknown): Promise<IpcResponse<unknown>>
      getLiveActivityResults(activityId: number): Promise<IpcResponse<LiveResults>>
      getLiveLeaderboard(sessionId: number): Promise<IpcResponse<unknown>>
      exportLiveSessionCsv(sessionId: number): Promise<IpcResponse<string>>
      getLiveHistoryForPromo(promoId: number, params?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<IpcResponse<import('./types').LiveSessionWithStats[]>>
      getLiveStatsForPromo(promoId: number): Promise<IpcResponse<import('./types').LiveStats>>
      emitLiveJoin(promoId: number): void
      emitLiveLeave(promoId: number): void
      onLiveActivityPushed(cb: (data: { activity: unknown }) => void): () => void
      onLiveActivityClosed(cb: (data: { activityId: number; leaderboard?: unknown[] }) => void): () => void
      onLiveResultsUpdate(cb: (data: { activityId: number; data: unknown }) => void): () => void
      onLiveSessionStarted(cb: (data: { sessionId: number }) => void): () => void
      onLiveSessionEnded(cb: (data: { sessionId: number }) => void): () => void
      onLiveInvite(cb: (data: { sessionId: number; title: string; joinCode: string; teacherName: string }) => void): () => void
      onLiveScoresUpdate(cb: (data: { sessionId: number; activityId: number; leaderboard: unknown[] }) => void): () => void
      // Live v2 (Spark + Pulse + Code + Board unifie)
      createLiveV2Session(payload: unknown): Promise<IpcResponse<import('./types').LiveV2Session>>
      getLiveV2Session(id: number): Promise<IpcResponse<import('./types').LiveV2Session>>
      getLiveV2SessionByCode(code: string): Promise<IpcResponse<import('./types').LiveV2Session>>
      getActiveLiveV2Session(promoId: number): Promise<IpcResponse<import('./types').LiveV2Session | null>>
      getLiveV2SessionsForPromo(promoId: number): Promise<IpcResponse<import('./types').LiveV2Session[]>>
      cloneLiveV2Session(id: number, payload: unknown): Promise<IpcResponse<import('./types').LiveV2Session>>
      reorderLiveV2Activities(sessionId: number, order: number[]): Promise<IpcResponse<import('./types').LiveV2Session>>
      updateLiveV2SessionStatus(id: number, status: string): Promise<IpcResponse<import('./types').LiveV2Session>>
      deleteLiveV2Session(id: number): Promise<IpcResponse<null>>
      addLiveV2Activity(sessionId: number, payload: unknown): Promise<IpcResponse<import('./types').LiveV2Activity>>
      updateLiveV2Activity(id: number, payload: unknown): Promise<IpcResponse<import('./types').LiveV2Activity>>
      deleteLiveV2Activity(id: number): Promise<IpcResponse<null>>
      setLiveV2ActivityStatus(id: number, status: string, extra?: unknown): Promise<IpcResponse<import('./types').LiveV2Activity>>
      submitLiveV2Response(activityId: number, payload: unknown): Promise<IpcResponse<{ id: number; answer: string; isCorrect?: boolean | null; points?: number; rank?: number | null; streak?: number }>>
      getLiveV2ActivityResults(activityId: number): Promise<IpcResponse<unknown>>
      getLiveV2Leaderboard(sessionId: number): Promise<IpcResponse<unknown[]>>
      toggleLiveV2Pin(responseId: number, pinned: boolean): Promise<IpcResponse<unknown>>
      saveLiveV2CodeSnapshot(activityId: number, content: string): Promise<IpcResponse<unknown>>
      exportLiveV2SessionCsv(sessionId: number): Promise<IpcResponse<string>>
      getLiveV2HistoryForPromo(promoId: number, params?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<IpcResponse<LiveSessionWithStats[]>>
      getLiveV2StatsForPromo(promoId: number): Promise<IpcResponse<LiveStats>>
      getLiveV2BoardCards(activityId: number): Promise<IpcResponse<import('./types').BoardCard[]>>
      addLiveV2BoardCard(activityId: number, payload: unknown): Promise<IpcResponse<import('./types').BoardCard>>
      updateLiveV2BoardCard(cardId: number, payload: { content?: string; columnName?: string }): Promise<IpcResponse<import('./types').BoardCard>>
      deleteLiveV2BoardCard(cardId: number): Promise<IpcResponse<null>>
      voteLiveV2BoardCard(cardId: number, vote: boolean): Promise<IpcResponse<{ voted: boolean }>>
      hideLiveV2BoardCard(cardId: number, hidden: boolean): Promise<IpcResponse<unknown>>
      // Self-paced
      toggleLiveV2SelfPaced(sessionId: number, selfPaced: boolean): Promise<IpcResponse<{ selfPaced: boolean }>>
      launchAllLiveV2(sessionId: number): Promise<IpcResponse<{ launched: number }>>
      getLiveV2Progress(sessionId: number): Promise<IpcResponse<{ id: number; title: string; type: string; category: string; responseCount: number }[]>>
      getLiveV2MyResponses(sessionId: number): Promise<IpcResponse<number[]>>
      // Confusion signal
      sendConfusionSignal(sessionId: number, active: boolean): Promise<IpcResponse<{ active: boolean; count: number }>>
      getConfusionCount(sessionId: number): Promise<IpcResponse<{ count: number }>>
      onLiveConfusionUpdate(cb: (data: { sessionId: number; count: number }) => void): () => void
      onLiveSelfPacedUpdate(cb: (data: { sessionId: number; selfPaced: boolean }) => void): () => void
      // Booking (mini-Calendly)
      getBookingEventTypes(): Promise<IpcResponse<{ id: number; title: string; slug: string; description?: string; duration_minutes: number; buffer_minutes: number; timezone: string; color: string; fallback_visio_url?: string; is_active: number; is_public: number; use_jitsi: number; created_at: string }[]>>
      createBookingEventType(payload: unknown): Promise<IpcResponse<unknown>>
      updateBookingEventType(id: number, payload: unknown): Promise<IpcResponse<unknown>>
      deleteBookingEventType(id: number): Promise<IpcResponse<null>>
      getBookingAvailability(): Promise<IpcResponse<{ id: number; day_of_week: number; start_time: string; end_time: string }[]>>
      setBookingAvailability(rules: unknown): Promise<IpcResponse<unknown>>
      createBookingToken(eventTypeId: number, studentId: number): Promise<IpcResponse<{ token: string; bookingUrl: string }>>
      createBulkBookingTokens(eventTypeId: number, promoId: number): Promise<IpcResponse<{ studentId: number; studentName: string; bookingUrl: string }[]>>
      getBookingPublicLink(eventTypeId: number): Promise<IpcResponse<{ publicUrl: string; isPublic: boolean; isActive: boolean; slug: string }>>
      // Campagnes
      getBookingCampaigns(): Promise<IpcResponse<unknown[]>>
      createBookingCampaign(payload: unknown): Promise<IpcResponse<unknown>>
      getBookingCampaign(id: number): Promise<IpcResponse<unknown>>
      updateBookingCampaign(id: number, payload: unknown): Promise<IpcResponse<unknown>>
      deleteBookingCampaign(id: number): Promise<IpcResponse<null>>
      launchBookingCampaign(id: number): Promise<IpcResponse<{ sent: number; skipped: number; alreadyInvited: number }>>
      remindBookingCampaign(id: number): Promise<IpcResponse<{ sent: number; pending: number }>>
      closeBookingCampaign(id: number): Promise<IpcResponse<unknown>>
      getBookingCampaignSlots(id: number): Promise<IpcResponse<Array<{ start: string; end: string; date: string; time: string }>>>
      getMyBookings(from?: string, to?: string): Promise<IpcResponse<unknown[]>>
      startBookingOAuth(): Promise<IpcResponse<{ url: string }>>
      getBookingOAuthStatus(): Promise<IpcResponse<{ connected: boolean; expiresAt?: string }>>
      disconnectBookingOAuth(): Promise<IpcResponse<null>>

      // Calendar iCal feed (abonnement externe Google/Outlook/Apple)
      getCalendarFeedToken(): Promise<IpcResponse<{ token: string | null; url: string | null; createdAt?: string }>>
      rotateCalendarFeedToken(): Promise<IpcResponse<{ token: string; url: string }>>
      revokeCalendarFeedToken(): Promise<IpcResponse<{ revoked: boolean }>>

      // TypeRace (mini-jeu typing speed)
      typeRaceRandomPhrase(excludeIds?: number[]): Promise<IpcResponse<{ id: number; text: string }>>
      typeRaceSubmitScore(payload: { phraseId: number; wpm: number; accuracy: number; durationMs: number }): Promise<IpcResponse<{ id: number; score: number }>>
      typeRaceLeaderboard(scope?: 'day' | 'week' | 'all', promoId?: number | null): Promise<IpcResponse<Array<{ rank: number; userType: 'student' | 'teacher'; userId: number; name: string; bestScore: number; bestWpm: number; plays: number }>>>
      typeRaceMyStats(): Promise<IpcResponse<{
        allTime: { plays: number; bestScore: number; bestWpm: number; avgWpm: number; avgAccuracy: number }
        today: { bestScore: number; bestWpm: number; plays: number }
        week: { bestScore: number }
        history: Array<{ id: number; score: number; wpm: number; accuracy: number; durationMs: number; createdAt: string }>
      }>>

      // Arcade games (Snake, Space Invaders, ...)
      gameSubmitScore(gameId: string, payload: { score: number; durationMs: number; meta?: Record<string, unknown> }): Promise<IpcResponse<{ id: number; score: number }>>
      gameLeaderboard(gameId: string, scope?: 'day' | 'week' | 'all', promoId?: number | null): Promise<IpcResponse<Array<{ rank: number; userType: 'student' | 'teacher'; userId: number; name: string; bestScore: number; plays: number }>>>
      gameMyStats(gameId: string): Promise<IpcResponse<{
        allTime: { plays: number; bestScore: number; avgScore: number }
        today: { bestScore: number; plays: number }
        week: { bestScore: number }
        history: Array<{ id: number; score: number; durationMs: number; createdAt: string }>
      }>>

      // Booking real-time
      onBookingNew(cb: (data: { bookingId: number; tutorName: string; studentName: string; eventTitle: string; startDatetime: string }) => void): () => void
      onBookingCancelled(cb: (data: { bookingId: number; tutorName: string; eventTitle: string }) => void): () => void

      emitLiveCodeUpdate(activityId: number, promoId: number, content: string, language: string | null): void
      onLiveCodeUpdate(cb: (data: { activityId: number; content: string; language: string | null }) => void): () => void
      onLiveBoardUpdate(cb: (data: { activityId: number; action: 'add' | 'delete' | 'vote' | 'update' | 'hide'; card?: unknown; cardId?: number; votes?: number; hidden?: boolean }) => void): () => void
      getLiveSessionsForPromo(promoId: number): Promise<IpcResponse<LiveSession[]>>
      cloneLiveSession(id: number, payload: unknown): Promise<IpcResponse<LiveSession>>
      reorderLiveActivities(sessionId: number, order: number[]): Promise<IpcResponse<LiveSession>>
      deleteLiveSession(id: number): Promise<IpcResponse<null>>
      updateLiveActivity(id: number, payload: unknown): Promise<IpcResponse<LiveActivity>>

      // Fichiers partagés en DM (prof uniquement)
      getDmFiles(): Promise<IpcResponse<{ message_id: number; student_id: number; student_name: string; file_name: string; file_url: string; is_image: boolean; file_size: number | null; sent_at: string; created_at: string }[]>>

      // Carnet de suivi
      getTeacherNotes(studentId: number): Promise<IpcResponse<{ id: number; student_id: number; teacher_id: number; promo_id: number; content: string; tag: string; category: string; student_name: string; created_at: string; updated_at: string }[]>>
      getTeacherNotesByPromo(promoId: number): Promise<IpcResponse<{ id: number; student_id: number; teacher_id: number; promo_id: number; content: string; tag: string; category: string; student_name: string; created_at: string; updated_at: string }[]>>
      getTeacherNotesSummary(promoId: number): Promise<IpcResponse<{ student_id: number; student_name: string; count: number; last_note_at: string }[]>>
      createTeacherNote(payload: { studentId: number; promoId: number; content: string; tag: string | null; category: string | null }): Promise<IpcResponse<{ id: number }>>
      updateTeacherNote(id: number, payload: { content: string; tag: string | null; category: string | null }): Promise<IpcResponse<{ changes: number }>>
      deleteTeacherNote(id: number): Promise<IpcResponse<null>>

      // Signatures
      createSignatureRequest(data: { message_id: number; dm_student_id: number; file_url: string; file_name: string }): Promise<IpcResponse<{ id: number }>>
      getSignatureRequests(status?: string): Promise<IpcResponse<unknown[]>>
      getPendingSignatureCount(): Promise<IpcResponse<{ count: number }>>
      getSignatureByMessage(messageId: number): Promise<IpcResponse<unknown>>
      signDocument(id: number, signatureImage: string): Promise<IpcResponse<{ signed_file_url: string }>>
      rejectSignature(id: number, reason: string): Promise<IpcResponse<unknown>>

      // Engagement
      getEngagementScores(promoId: number): Promise<IpcResponse<{ studentId: number; name: string; score: number; messages: number; onTime: number; late: number; missing: number; totalDevoirs: number; submitted: number; lastActivity: string | null; atRisk: boolean }[]>>

      // Modules enrichissement (enable/disable)
      getModules(): Promise<IpcResponse<Record<string, boolean>>>
      setModuleEnabled(module: string, enabled: boolean): Promise<IpcResponse<Record<string, boolean>>>

      // Grade notifications
      onGradeNew(cb: (data: { devoirTitle: string; note: string | null; feedback: string | null; devoirId: number; category: string | null }) => void): () => void

      // Lumen (liseuse de cours adossee a GitHub)
      // GitHub auth
      getLumenGithubStatus(): Promise<IpcResponse<import('./types').LumenGithubStatus>>
      connectLumenGithub(token: string): Promise<IpcResponse<{ login: string; name: string; avatarUrl: string }>>
      disconnectLumenGithub(): Promise<IpcResponse<{ disconnected: boolean }>>

      // Promo <-> org
      getLumenPromoOrg(promoId: number): Promise<IpcResponse<{ org: string | null }>>
      setLumenPromoOrg(promoId: number, org: string | null): Promise<IpcResponse<{ org: string | null }>>

      // Repos
      getLumenReposForPromo(promoId: number): Promise<IpcResponse<{ repos: import('./types').LumenRepo[]; org: string | null }>>
      syncLumenReposForPromo(promoId: number): Promise<IpcResponse<{ synced: number; errors: Array<{ repo: string; error: string }>; repos: import('./types').LumenRepo[] }>>
      getLumenRepo(id: number): Promise<IpcResponse<import('./types').LumenRepo>>
      createLumenRepoFromScaffold(promoId: number, slug: string, blocTitle: string): Promise<IpcResponse<{ created: { owner: string; repo: string; defaultBranch: string }; repos: import('./types').LumenRepo[] }>>
      searchLumenChapters(promoId: number, q: string, limit?: number): Promise<IpcResponse<{ results: Array<{ repoId: number; repoName: string; chapterPath: string; chapterTitle: string; snippet: string; rank: number }> }>>

      // Integration projets Cursus
      getLumenReposByProjectName(promoId: number, name: string): Promise<IpcResponse<{ repos: import('./types').LumenRepo[] }>>
      getLumenUnlinkedReposForPromo(promoId: number): Promise<IpcResponse<{ repos: import('./types').LumenRepo[] }>>
      setLumenRepoProject(repoId: number, projectId: number | null): Promise<IpcResponse<import('./types').LumenRepo>>
      setLumenRepoVisibility(repoId: number, visible: boolean): Promise<IpcResponse<import('./types').LumenRepo>>

      // Integration devoirs <-> chapitres
      getLumenTravauxForChapter(repoId: number, path: string): Promise<IpcResponse<{ travaux: import('./types').LumenLinkedTravail[] }>>
      getLumenChaptersForTravail(travailId: number): Promise<IpcResponse<{ chapters: import('./types').LumenLinkedChapter[] }>>
      linkLumenChapterToTravail(travailId: number, repoId: number, chapterPath: string): Promise<IpcResponse<{ ok: true }>>
      unlinkLumenChapterFromTravail(travailId: number, repoId: number, chapterPath: string): Promise<IpcResponse<{ ok: true }>>

      // Chapitres
      getLumenChapterContent(repoId: number, path: string): Promise<IpcResponse<import('./types').LumenChapterContent>>

      // Edition de chapitre (v2.67) — teacher / admin only
      updateLumenChapterFile(
        repoId: number,
        body: { path: string; content: string; sha: string; message?: string },
      ): Promise<IpcResponse<{ ok: true; content: string; sha: string; commitSha: string }>>
      createLumenChapterFile(
        repoId: number,
        body: { path: string; content: string; message?: string },
      ): Promise<IpcResponse<{ ok: true; content: string; sha: string; commitSha: string }>>

      // Tracking lecture
      markLumenChapterRead(repoId: number, path: string): Promise<IpcResponse<{ ok: true }>>
      getLumenMyReads(): Promise<IpcResponse<{ reads: import('./types').LumenRead[] }>>
      getLumenReadCountsForRepo(repoId: number): Promise<IpcResponse<{ counts: Array<{ path: string; readers: number }> }>>
      getLumenReadCountsForPromo(promoId: number): Promise<IpcResponse<{ counts: Array<{ repo_id: number; path: string; readers: number }> }>>

      // Notes privees etudiant
      getLumenChapterNote(repoId: number, path: string): Promise<IpcResponse<{ note: import('./types').LumenChapterNote | null }>>
      saveLumenChapterNote(repoId: number, path: string, content: string): Promise<IpcResponse<{ note: import('./types').LumenChapterNote }>>
      deleteLumenChapterNote(repoId: number, path: string): Promise<IpcResponse<{ ok: true }>>
      getLumenMyNotes(): Promise<IpcResponse<{ notes: Array<import('./types').LumenChapterNote & { owner: string; repo: string; manifest_json: string | null }> }>>
      getLumenMyNotedChapters(): Promise<IpcResponse<{ items: Array<{ repo_id: number; path: string }> }>>
      getLumenStatsForPromo(promoId: number): Promise<IpcResponse<{ repos: number; reads: number }>>
      downloadLumenNotesExport(): Promise<{ ok: boolean; data?: { filename: string; path: string } | null; error?: string }>

      // Kanban
      getKanbanCards(travailId: number, groupId: number): Promise<IpcResponse<import('./types').KanbanCard[]>>
      createKanbanCard(travailId: number, groupId: number, payload: unknown): Promise<IpcResponse<import('./types').KanbanCard>>
      updateKanbanCard(id: number, payload: unknown): Promise<IpcResponse<import('./types').KanbanCard>>
      deleteKanbanCard(id: number): Promise<IpcResponse<null>>

      // Reminders / Agenda
      getReminders(promoTag?: string | null): Promise<IpcResponse<import('./types').Reminder[]>>
      createReminder(payload: unknown): Promise<IpcResponse<import('./types').Reminder>>
      updateReminder(id: number, payload: unknown): Promise<IpcResponse<import('./types').Reminder>>
      deleteReminder(id: number): Promise<IpcResponse<null>>

      // Calendrier (iCal sync)
      getCalendarFeedUrl(): string
      getOutlookEvents(from: string, to: string): Promise<IpcResponse<{ events: Array<{ id: string; subject: string; start: string; end: string; timezone?: string; isAllDay: boolean; location: string | null; bodyPreview: string | null; teamsJoinUrl: string | null; organizer: string | null; showAs: string; categories: string[] }>; connected: boolean }>>
      createOutlookEvent(payload: { subject: string; startDateTime: string; endDateTime: string; body?: string; attendees?: Array<{ email: string; name?: string }>; createTeams?: boolean }): Promise<IpcResponse<{ eventId: string; teamsJoinUrl: string | null }>>
      deleteOutlookEvent(id: string): Promise<IpcResponse<null>>

      // Onboarding wizard
      getOnboardingStatus(studentId: number): Promise<boolean>
      completeOnboarding(studentId: number): Promise<IpcResponse<null>>

      // Cache offline
      offlineWrite(key: string, data: unknown): Promise<IpcResponse<null>>
      offlineRead(key: string): Promise<IpcResponse<unknown>>
      offlineClear(): Promise<IpcResponse<null>>

      // Diagnostic / logs
      onRuntimeError(cb: (data: { message: string }) => void): () => void
      openLogsFolder(): Promise<IpcResponse<null>>

      // Auto-update
      onSignatureUpdate(cb: (data: { id: number; status: string; signed_file_url?: string; signer_name?: string; rejection_reason?: string }) => void): () => void
      onDocumentNew(cb: (data: { name: string; category?: string }) => void): () => void
      onAssignmentNew(cb: (data: { title: string; category?: string; deadline?: string }) => void): () => void
      onUpdaterAvailable(cb: (version: string) => void): () => void
      onUpdaterDownloaded(cb: (payload: { version: string; releaseNotes: string | null } | string) => void): () => void
      onUpdaterProgress(cb: (percent: number) => void): () => void
      onUpdaterError(cb: (error: string) => void): () => void
      updaterQuitAndInstall(): void
      checkForUpdates(): Promise<{ ok: boolean; data?: { version: string; available: boolean; disabled?: boolean; message?: string | null }; error?: string }>
      getUpdaterRemoteConfig(): Promise<{ ok: boolean; data?: { disabled: boolean; minVersion: string | null; channel: 'stable' | 'beta'; message: string | null; checkEveryMinutes: number }; error?: string }>
      setUpdaterBetaOptIn(enabled: boolean): Promise<{ ok: boolean; data?: { enabled: boolean; restartRequired: boolean }; error?: string }>
    }
  }
}
