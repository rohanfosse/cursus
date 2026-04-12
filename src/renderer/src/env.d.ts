/// <reference types="vite/client" />

import type {
  User, Promotion, Channel, Message, Devoir, Depot,
  AppDocument, Ressource, Group, Student, SendMessagePayload,
  Rubric, RubricScore, LiveSession, LiveActivity, LiveResults,
  RexSession, RexActivity, RexResults,
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
      getStudentProfile(studentId: number): Promise<IpcResponse<{ student: { id: number; name: string; email: string; avatar_initials: string; photo_data: string | null; promo_name: string }; travaux: unknown[] }>>
      getStudentTravaux(studentId: number): Promise<IpcResponse<Devoir[]>>

      // Ressources
      getRessources(travailId: number): Promise<IpcResponse<Ressource[]>>
      addRessource(payload: object): Promise<IpcResponse<{ id: number }>>
      deleteRessource(id: number): Promise<IpcResponse<null>>

      // Groupes par projet
      getTravailGroupMembers(travailId: number): Promise<IpcResponse<object[]>>

      // Brouillon / publication programmee
      updateTravailPublished(payload: object): Promise<IpcResponse<null>>
      updateTravailScheduled(payload: { travailId: number; scheduledAt: string | null }): Promise<IpcResponse<null>>

      // Promotions & canaux
      createPromotion(payload: object): Promise<IpcResponse<{ id: number }>>
      deletePromotion(promoId: number): Promise<IpcResponse<null>>
      renamePromotion(promoId: number, name: string, color?: string): Promise<IpcResponse<null>>
      createChannel(payload: object): Promise<IpcResponse<{ id: number }>>
      renameChannel(id: number, name: string): Promise<IpcResponse<null>>
      deleteChannel(id: number): Promise<IpcResponse<null>>
      archiveChannel(id: number): Promise<IpcResponse<null>>
      restoreChannel(id: number): Promise<IpcResponse<null>>
      getArchivedChannels(promoId: number): Promise<IpcResponse<Channel[]>>
      renameCategory(promoId: number, oldCategory: string, newCategory: string): Promise<IpcResponse<null>>
      deleteCategory(promoId: number, category: string): Promise<IpcResponse<null>>
      updateChannelMembers(payload: object): Promise<IpcResponse<null>>
      updateChannelCategory(channelId: number, category: string | null): Promise<IpcResponse<null>>
      updateChannelPrivacy(channelId: number, isPrivate: boolean, members?: number[]): Promise<IpcResponse<unknown>>

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

      // Upload fichier vers le serveur → URL publique + taille
      uploadFile(localPath: string): Promise<IpcResponse<{ url: string; file_size?: number }>>

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
      addChannelDocument(payload: object): Promise<IpcResponse<{ id: number }>>
      deleteChannelDocument(id: number): Promise<IpcResponse<null>>

      // Documents de projet
      getProjectDocuments(promoId: number, project?: string | null): Promise<IpcResponse<AppDocument[]>>
      addProjectDocument(payload: object): Promise<IpcResponse<{ id: number }>>
      updateProjectDocument(id: number, payload: object): Promise<IpcResponse<unknown>>
      searchDocuments(promoId: number, q: string): Promise<IpcResponse<AppDocument[]>>
      linkDocumentToTravail(docId: number, travailId: number | null): Promise<IpcResponse<unknown>>

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

      // Projets (entite backend)
      getProjectsByPromo(promoId: number): Promise<IpcResponse<unknown[]>>
      getProjectById(id: number): Promise<IpcResponse<unknown>>
      createProject(payload: object): Promise<IpcResponse<unknown>>
      updateProject(id: number, payload: object): Promise<IpcResponse<unknown>>
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
      onPresenceUpdate?(cb: (data: { id: number; name: string; role: string }[]) => void): () => void
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
      getLiveSessionsForPromo(promoId: number): Promise<IpcResponse<LiveSession[]>>
      cloneLiveSession(id: number, payload: unknown): Promise<IpcResponse<LiveSession>>
      reorderLiveActivities(sessionId: number, order: number[]): Promise<IpcResponse<LiveSession>>
      deleteLiveSession(id: number): Promise<IpcResponse<null>>
      updateLiveActivity(id: number, payload: unknown): Promise<IpcResponse<LiveActivity>>

      // REX (Retour d'Experience)
      createRexSession(payload: unknown): Promise<IpcResponse<RexSession>>
      getRexSession(id: number): Promise<IpcResponse<RexSession>>
      getRexSessionByCode(code: string): Promise<IpcResponse<RexSession>>
      getActiveRexSession(promoId: number): Promise<IpcResponse<RexSession>>
      updateRexSessionStatus(id: number, status: string): Promise<IpcResponse<RexSession>>
      addRexActivity(sessionId: number, payload: unknown): Promise<IpcResponse<RexActivity>>
      deleteRexActivity(id: number): Promise<IpcResponse<null>>
      setRexActivityStatus(id: number, status: string): Promise<IpcResponse<RexActivity>>
      submitRexResponse(activityId: number, payload: unknown): Promise<IpcResponse<unknown>>
      getRexActivityResults(activityId: number): Promise<IpcResponse<RexResults>>
      toggleRexPin(responseId: number, pinned: boolean): Promise<IpcResponse<null>>
      exportRexSession(sessionId: number, format: string): Promise<IpcResponse<unknown>>
      getRexHistoryForPromo(promoId: number, params?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<IpcResponse<import('./types').RexSessionWithStats[]>>
      getRexStatsForPromo(promoId: number): Promise<IpcResponse<import('./types').RexStats>>

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
      emitRexJoin(promoId: number): void
      emitRexLeave(promoId: number): void
      onRexActivityPushed(cb: (data: { activity: unknown }) => void): () => void
      onRexActivityClosed(cb: (data: { activityId: number }) => void): () => void
      onRexResultsUpdate(cb: (data: { activityId: number; data: unknown }) => void): () => void
      onRexSessionStarted(cb: (data: { sessionId: number }) => void): () => void
      onRexSessionEnded(cb: (data: { sessionId: number }) => void): () => void
      onRexInvite(cb: (data: { sessionId: number; title: string; joinCode: string; teacherName: string }) => void): () => void
      getRexSessionsForPromo(promoId: number): Promise<IpcResponse<RexSession[]>>
      cloneRexSession(id: number, payload: unknown): Promise<IpcResponse<RexSession>>
      reorderRexActivities(sessionId: number, order: number[]): Promise<IpcResponse<RexSession>>
      deleteRexSession(id: number): Promise<IpcResponse<null>>
      updateRexActivity(id: number, payload: unknown): Promise<IpcResponse<RexActivity>>

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

      // Onboarding wizard
      getOnboardingStatus(studentId: number): Promise<boolean>
      completeOnboarding(studentId: number): Promise<any>

      // Cache offline
      offlineWrite(key: string, data: unknown): Promise<IpcResponse<null>>
      offlineRead(key: string): Promise<IpcResponse<unknown>>
      offlineClear(): Promise<IpcResponse<null>>

      // Auto-update
      onSignatureUpdate(cb: (data: { id: number; status: string; signed_file_url?: string; signer_name?: string; rejection_reason?: string }) => void): () => void
      onDocumentNew(cb: (data: { name: string; category?: string }) => void): () => void
      onAssignmentNew(cb: (data: { title: string; category?: string; deadline?: string }) => void): () => void
      onUpdaterAvailable(cb: (version: string) => void): () => void
      onUpdaterDownloaded(cb: (version: string) => void): () => void
      onUpdaterProgress(cb: (percent: number) => void): () => void
      onUpdaterError(cb: (error: string) => void): () => void
      updaterQuitAndInstall(): void
      checkForUpdates(): Promise<{ ok: boolean; data?: { version: string; available: boolean }; error?: string }>
    }
  }
}
