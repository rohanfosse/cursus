import { test, expect } from '@playwright/test'
import { STUDENT, TEACHER, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Vérifie que le guard de route (router.beforeEach) protège correctement
 * les routes réservées aux rôles 'teacher' et 'admin'.
 */
test.describe('Gardes de routes par rôle', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant accédant à /admin est redirigé vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // Tentative d'accès direct à la route admin (hash routing)
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })

  test('un étudiant accédant à /booking est redirigé vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })

  test('un enseignant peut accéder à /booking (route teacher-only)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/booking')
    // L'enseignant ne doit PAS être redirigé vers le dashboard
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/dashboard/)
    // La page booking doit rendre quelque chose (pas de crash)
    await expect(page.locator('text=/erreur est survenue|500/i')).not.toBeVisible()
  })

})
