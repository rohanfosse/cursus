import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {
  test('un enseignant navigue vers devoirs et voit le contenu de la page', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    // The view should have rendered (main content area, assignments list or empty state)
    await expect(page.locator('main, .view-container, [class*="devoirs"]').first()).toBeVisible({ timeout: 15_000 })
  })
})
