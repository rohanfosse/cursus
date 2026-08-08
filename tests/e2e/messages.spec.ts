import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Flows couverts :
 *   - Enseignant accède à la vue messages (zone de chat visible)
 *   - La sidebar liste au moins un canal ou DM (données réelles chargées)
 */
test.describe('Vue Messages', () => {

  test('enseignant accède à la vue messages et voit la zone de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Une zone de mise en page messages (sidebar ou conteneur principal) est visible
    const layout = page
      .locator('aside, [class*="messages-view"], [class*="messages-layout"], [class*="chat-"]')
      .first()
    await expect(layout).toBeVisible({ timeout: 10_000 })
  })

  test('la sidebar messages contient au moins un canal ou DM', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Laisser les canaux se charger depuis l'API
    await page.waitForTimeout(1_500)

    const channelItem = page
      .locator(
        [
          '[data-testid="channel-item"]',
          '.channel-item',
          '[class*="channel-name"]',
          '[class*="sidebar"] li',
          'aside li',
        ].join(', '),
      )
      .first()

    await expect(channelItem).toBeVisible({ timeout: 10_000 })
  })
})
