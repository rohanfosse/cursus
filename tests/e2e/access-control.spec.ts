import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Contrôle d\'accès par rôle', () => {
  test('un enseignant accédant à /admin est redirigé vers le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // Navigate directly to the admin route (requiredRole: 'admin')
    await page.goto('/#/admin')
    // Router guard: teacher role < admin → redirect to /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('un enseignant peut accéder à la route /booking (requiredRole: teacher)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/booking')
    // Teacher satisfies requiredRole:'teacher' → no redirect
    await expect(page).toHaveURL(/booking/, { timeout: 10_000 })
  })
})
