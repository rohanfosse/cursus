import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Gardes de route (contrôle d\'accès par rôle)', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant est redirigé de /admin vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // Tentative d'accès direct à la route admin-only (requiredRole: 'admin')
    await page.goto('/#/admin')
    // Le garde de route doit rediriger vers le dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // L'interface admin ne doit jamais s'afficher
    await expect(page.locator('.admin-view')).not.toBeVisible()
  })

  test('un étudiant est redirigé de /booking vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // Tentative d'accès à la route réservée aux enseignants (requiredRole: 'teacher')
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
