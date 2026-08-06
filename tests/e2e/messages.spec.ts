import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('affiche l\'interface de messagerie après navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // L'invite "sélectionner un canal" ou le corps du canal actif doit être présent.
    // Ces deux sélecteurs couvrent : aucun canal sélectionné (#no-channel-hint) et
    // un canal déjà actif (.channel-body), les deux étant des états valides.
    const messagesUi = page.locator('#no-channel-hint, .channel-body, #messages-container')
    await expect(messagesUi.first()).toBeAttached({ timeout: 15_000 })

    // Aucune erreur fatale levée par ErrorBoundary
    await expect(page.locator('text=/erreur inattendue|something went wrong/i')).not.toBeVisible()
  })

})
