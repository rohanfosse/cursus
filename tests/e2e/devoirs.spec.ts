import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('un etudiant peut consulter la vue devoirs', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Conteneur principal monté sans erreur
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // Contenu chargé : résumé étudiant (dv-page) ou état vide (es = EmptyState)
    await expect(
      page.locator('.devoirs-content .dv-page, .devoirs-content .es')
    ).toBeVisible({ timeout: 10_000 })
  })

})
