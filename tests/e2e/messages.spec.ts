import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test('un enseignant navigue vers messages et voit la sidebar des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // Channel sidebar (list or empty state) must be visible
    await expect(
      page.locator('.channel-list, .channels, [class*="channel"], aside').first()
    ).toBeVisible({ timeout: 20_000 })
  })
})
