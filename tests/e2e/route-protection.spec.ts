import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Protection des routes (guards)', () => {
  test('enseignant redirigé depuis /admin vers /dashboard (rôle insuffisant)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Tentative de navigation directe vers la route admin (requiert le rôle 'admin', niveau 3)
    // L'enseignant a le rôle 'teacher' (niveau 2) → le guard redirige vers /dashboard
    await page.goto('/#/admin')

    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
