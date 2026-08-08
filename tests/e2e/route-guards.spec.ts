import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Verifie que le guard de route (router.beforeEach) redirige les utilisateurs
 * vers /dashboard quand ils tentent d'acceder a une route dont le role requis
 * depasse leur niveau (etudiant -> teacher/admin).
 */
test.describe('Controles d\'acces par role', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('etudiant est redirige de /admin vers le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /admin requiert le role 'admin' ; un etudiant doit etre redirige
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant est redirige de /booking vers le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /booking requiert le role 'teacher' ; un etudiant doit etre redirige
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant peut acceder a /booking sans redirection', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/booking')
    // Un enseignant satisfait la contrainte requiredRole:'teacher'
    await expect(page).toHaveURL(/booking/, { timeout: 10_000 })
    // L'app-shell doit etre present : la page est bien montee, pas d'erreur fatale
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible({ timeout: 10_000 })
  })
})
