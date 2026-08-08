import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Flow couvert :
 *   - Un étudiant ne peut pas accéder à /admin
 *   - Le guard Vue Router le redirige vers une autre section
 *
 * Ce test vérifie une propriété de sécurité fondamentale :
 * les routes protégées par meta.requiredRole bloquent bien les rôles inférieurs.
 */
test.describe('Contrôle accès /admin', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant est redirigé depuis /admin (guard requiredRole)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tenter la navigation directe vers la route admin
    await page.goto('/#/admin')
    // Laisser le guard Vue Router traiter la navigation
    await page.waitForTimeout(1_500)

    // La route guard doit avoir redirigé : l'URL hash ne doit plus contenir /admin
    await expect(page).not.toHaveURL(/#\/admin/, { timeout: 5_000 })
  })
})
