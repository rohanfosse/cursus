import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

/**
 * Test E2E : Accès et rendu de la vue Devoirs
 *
 * Scenarios :
 *   - Un enseignant navigue vers /devoirs et voit la vue enseignant (TeacherProjectHome)
 *   - Un étudiant navigue vers /devoirs et voit la vue étudiant (StudentDevoirsView)
 *
 * Prérequis :
 *   Serveur démarré sur :3001, frontend sur :5174
 *   Enseignant rfosse@cesi.fr et un étudiant provisonné via l'API
 */

test.describe('Devoirs', () => {

  test.beforeAll(async () => {
    // S'assurer que le compte étudiant existe avant les tests
    await provisionStudent()
  })

  test('enseignant navigue vers la vue devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // Le conteneur principal de la vue Devoirs doit être présent
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test('étudiant navigue vers la vue devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Le conteneur principal de la vue Devoirs doit être présent
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // En vue étudiant, la barre de stats ou l'écran d'accueil projet est rendu
    // (StudentDevoirsView est monté dès que .devoirs-area est visible)
    const studentContent = page.locator(
      '.devoirs-scroll-area, .student-devoirs, .devoirs-content',
    ).first()
    await expect(studentContent).toBeAttached({ timeout: 10_000 })
  })

})
