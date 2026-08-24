import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Navigation vers Devoirs (enseignant)
 *
 * Aucun test existant ne couvre l'ouverture de la vue /devoirs par le
 * nav-rail — la deuxieme feature la plus critique de l'app apres l'auth,
 * puisque toute la boucle notation/depot passe par la.
 *
 * On verifie :
 *   1. Le clic sur le bouton nav-rail "Devoirs" pousse la route.
 *   2. Le composant DevoirsHeader se monte (le texte "Devoirs" est present
 *      dans le breadcrumb — cf. DevoirsHeader.vue l.32 & 38).
 *   3. Cote enseignant, le bouton d'action "Nouveau devoir" est offert
 *      (cf. DevoirsHeader.vue l.44-46 — v-if="appStore.isTeacher"). C'est
 *      le signal que le split teacher/student fonctionne encore.
 */
test.describe('Navigation vers Devoirs (enseignant)', () => {

  test('l\'enseignant peut ouvrir la vue Devoirs depuis le nav-rail', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await navigateTo(page, 'devoirs')

    // Header du module : texte "Devoirs" (breadcrumb ou titre plein). On
    // scope au container `.devoirs-area` (defini dans DevoirsView.vue) pour
    // eviter de matcher accidentellement le libelle de l'icone nav-rail.
    const devoirsArea = page.locator('.devoirs-area')
    await expect(devoirsArea).toBeVisible({ timeout: 15_000 })
    await expect(devoirsArea.getByText(/Devoirs/).first()).toBeVisible()

    // Bouton "Nouveau devoir" — reserve aux enseignants (v-if isTeacher).
    // Sa presence prouve que le role est bien reconnu et que la header
    // teacher-only s'affiche.
    await expect(page.getByRole('button', { name: /Nouveau devoir/i })).toBeVisible({ timeout: 10_000 })
  })

})
