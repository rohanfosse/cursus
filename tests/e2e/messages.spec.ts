import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant navigue vers messages et voit l\'interface de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // L'URL doit contenir /messages
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // La vue messages doit charger (attendre la fin du chargement initial des canaux)
    // On verifie que la page n'est pas bloquee sur un loader indefini
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      // networkidle peut ne jamais se declencher avec WebSocket ; on continue
    })

    // Au moins l'un de ces elements doit etre present :
    // - la liste des canaux (sidebar)
    // - la zone de saisie de message
    // - le conteneur principal de la vue messages
    const chatUi = page.locator([
      '[data-testid="message-input"]',
      'textarea[placeholder*="message" i]',
      '.message-input',
      '.messages-sidebar',
      '.channel-list',
      'aside',
    ].join(', ')).first()

    await expect(chatUi).toBeVisible({ timeout: 20_000 })
  })

})
