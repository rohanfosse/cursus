import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant : la vue messages charge sans erreur', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // La zone principale de messages doit être montée
    await expect(page.locator('#main-area, [class*="main-area"], [class*="messages"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant : au moins un canal est visible dans la liste', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // La sidebar ou le panneau de canaux doit lister au moins un canal
    // Sélecteurs multi-stratégie : canal classique, DM, ou mobile list
    const channelItem = page.locator(
      '[class*="channel-item"], [class*="channel-btn"], [class*="channel-row"], aside li, [data-testid="channel-item"]'
    ).first()
    await expect(channelItem).toBeVisible({ timeout: 15_000 })
  })

  test('enseignant : la zone de saisie de message est présente quand un canal est actif', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Cliquer sur le premier canal disponible pour l'activer
    const firstChannel = page.locator(
      '[class*="channel-item"], [class*="channel-btn"], [class*="channel-row"], aside li'
    ).first()

    const channelVisible = await firstChannel.isVisible({ timeout: 10_000 }).catch(() => false)
    if (channelVisible) {
      await firstChannel.click()
      await page.waitForTimeout(1_000)
    }

    // La zone de saisie doit apparaître (MessageInput — textarea ou div contenteditable)
    const inputArea = page.locator(
      'textarea[placeholder], div[contenteditable="true"], [class*="message-input"] textarea, [class*="compose"] textarea'
    ).first()
    await expect(inputArea).toBeVisible({ timeout: 10_000 })
  })

})
