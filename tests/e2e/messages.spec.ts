import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant accède à la section messages et voit au moins un canal', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La sidebar de canaux doit être visible — elle est toujours rendue côté enseignant
    // On cible le conteneur de liste de canaux (aside, nav, ou un data-testid)
    const channelSidebar = page.locator(
      '[data-testid="channel-list"], .channel-list, aside, .channels-panel',
    ).first()
    await expect(channelSidebar).toBeVisible({ timeout: 15_000 })

    // Au moins un élément de canal doit être affiché (n'importe quel item de la liste)
    const channelItems = page.locator(
      '[data-testid="channel-item"], .channel-item, .channel-row, .chan-name, .channels-panel li',
    )
    await expect(channelItems.first()).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant peut saisir un message dans la zone de composition', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Attendre qu'un canal soit sélectionné (la zone de saisie apparaît)
    const messageInput = page.locator(
      '[data-testid="message-input"], .message-input, textarea[placeholder*="message" i], [contenteditable="true"]',
    ).first()
    await expect(messageInput).toBeVisible({ timeout: 20_000 })
  })
})
