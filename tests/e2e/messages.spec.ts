import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant navigue vers les messages et voit la vue chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // La mise en page messages (sidebar canaux + zone chat) doit etre presente
    const messagesLayout = page.locator(
      '.messages-layout, .messages-area, [data-testid="messages-view"], .app-columns',
    ).first()
    await expect(messagesLayout).toBeVisible({ timeout: 15_000 })
  })

  test('la section messages expose une zone de saisie ou une liste de canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Attendre que le contenu soit rendu (chunks lazy + fetch initial)
    await page.waitForTimeout(2_000)
    // Au moins un des deux elements caracteristiques de la vue messages doit etre present :
    //  - un input de message (zone de saisie)
    //  - une liste de canaux dans la sidebar
    const hasInput = await page.locator(
      'textarea[placeholder], input[placeholder*="message" i], [data-testid="message-input"]',
    ).first().isVisible({ timeout: 5_000 }).catch(() => false)

    const hasChannels = await page.locator(
      'aside, [data-testid="channel-list"], .channel-list, nav li',
    ).first().isVisible({ timeout: 5_000 }).catch(() => false)

    expect(
      hasInput || hasChannels,
      'La vue messages doit afficher soit une zone de saisie soit une liste de canaux',
    ).toBe(true)
  })

})
