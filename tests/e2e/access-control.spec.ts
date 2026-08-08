import { test, expect } from '@playwright/test'
import { STUDENT, TEACHER, provisionStudent, loginAndWaitDashboard } from './helpers'

/**
 * Couverture : contrôle d'accès basé sur les rôles (route guard du router).
 *
 * Les routes /booking et /fichiers requièrent le rôle "teacher".
 * Un étudiant accédant à ces URLs doit être redirigé vers /dashboard.
 */
test.describe('Contrôle d\'accès par rôle', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant est redirigé depuis /booking (route enseignant)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/booking')
    // Le route guard doit rediriger immédiatement vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 10_000 })
  })

  test('un étudiant est redirigé depuis /fichiers (route enseignant)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 10_000 })
  })

  test('un enseignant peut accéder à /booking sans redirection', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/booking')
    // L'enseignant doit rester sur /booking (pas de redirect)
    await expect(page).toHaveURL(/booking/, { timeout: 10_000 })
    // Pas de redirection vers dashboard
    await expect(page).not.toHaveURL(/dashboard/)
  })
})
