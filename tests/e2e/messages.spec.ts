import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test('enseignant : accède à la section messages et voit la sidebar des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    await expect(
      page.locator('aside, [data-testid="channels-sidebar"], .channels-sidebar').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant : la liste des canaux contient au moins un canal', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Allow channels to load from the API
    await page.waitForTimeout(2_000)
    const count = await page
      .locator('[data-testid="channel-item"], .channel-item, aside li, .channels-list li')
      .count()
    expect(count).toBeGreaterThan(0)
  })
})
