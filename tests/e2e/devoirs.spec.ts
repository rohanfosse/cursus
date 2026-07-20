import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('un enseignant voit l\'en-tête "Devoirs" et le bouton de création', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // L'en-tête "Devoirs" doit être visible (classe .dh-title-text dans DevoirsHeader)
    await expect(
      page.locator('.dh-title-text, .dh-title'),
    ).toContainText('Devoirs', { timeout: 10_000 })

    // Le CTA "Nouveau devoir" est réservé aux enseignants — sa présence confirme
    // que le bon rôle est reconnu et que DevoirsHeader est monté sans erreur.
    await expect(
      page.locator('button.dh-new, button:has-text("Nouveau devoir")'),
    ).toBeVisible({ timeout: 10_000 })

    // Aucun ErrorBoundary ne doit avoir capturé d'exception (class .eb-fallback)
    await expect(page.locator('.eb-fallback')).not.toBeVisible()
  })

})
