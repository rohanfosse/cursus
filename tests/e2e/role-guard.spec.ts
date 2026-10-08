import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, login, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Verifie les gardes de route bases sur les roles.
 * Router guard (beforeEach) redirige vers /dashboard si le role est insuffisant.
 */
test.describe('Role guard', () => {

  test.describe('Route /admin (requiredRole: admin)', () => {

    test('un enseignant (role teacher) est redirige depuis /admin vers /dashboard', async ({ page }) => {
      await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
      // Forcer la navigation directe par URL
      await page.goto('/#/admin')
      // Le guard doit rediriger vers /dashboard car teacher < admin
      await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    })

    test('un etudiant est redirige depuis /admin vers /dashboard', async ({ page }) => {
      // Provisionner l'etudiant de test s'il n'existe pas encore
      await provisionStudent()
      await login(page, STUDENT.email, STUDENT.password)
      await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })
      await page.goto('/#/admin')
      await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    })

  })

  test.describe('Route /booking (requiredRole: teacher)', () => {

    test('un enseignant accede a /booking sans redirection', async ({ page }) => {
      await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
      await page.goto('/#/booking')
      // Un enseignant doit rester sur /booking
      await expect(page).toHaveURL(/booking/, { timeout: 10_000 })
    })

    test('un etudiant est redirige depuis /booking vers /dashboard', async ({ page }) => {
      await provisionStudent()
      await login(page, STUDENT.email, STUDENT.password)
      await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })
      await page.goto('/#/booking')
      await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    })

  })

})
