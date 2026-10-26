import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Verifie que le guard de route (router/index.ts beforeEach) redirige
 * les utilisateurs non autorises vers /dashboard.
 *
 * Routes testees :
 *  - /admin  → requiredRole: 'admin'   (etudiant et enseignant sont tous les deux bloques)
 *  - /booking → requiredRole: 'teacher' (etudiant bloque, enseignant autorise)
 */
test.describe('Guards de roles', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('etudiant : /admin → redirige vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/admin')
    // Laisser le guard s'executer
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant : /booking → redirige vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant : /admin → redirige vers /dashboard (role insuffisant)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
