import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Garde des routes par rôle', () => {
  test('enseignant redirigé vers /dashboard en accédant à /admin (rôle admin requis)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // Tentative d'accès direct à la route protégée
    await page.goto('/#/admin')
    // Le router guard doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
