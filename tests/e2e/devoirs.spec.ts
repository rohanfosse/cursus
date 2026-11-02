import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant accede a la vue devoirs et voit le titre de section', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // L'en-tete DevoirsHeader doit afficher "Devoirs" (hors contexte projet actif)
    await expect(
      page.locator('.dh-title-text, h1').filter({ hasText: /devoirs/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    // Pas d'erreur globale (ErrorBoundary)
    await expect(page.locator('text=/une erreur est survenue|erreur critique/i')).not.toBeVisible()
  })

})
