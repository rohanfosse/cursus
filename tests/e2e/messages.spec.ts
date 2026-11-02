import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant accede a la vue messages et peut ecrire un message', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Le textarea de saisie doit etre present (id="message-input", aria-label="Écrire un message")
    await expect(page.locator('#message-input, textarea[aria-label*="message" i]').first())
      .toBeVisible({ timeout: 15_000 })
    // Pas d'erreur globale
    await expect(page.locator('text=/une erreur est survenue|erreur critique/i')).not.toBeVisible()
  })

})
