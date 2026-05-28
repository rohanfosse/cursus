import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, SEL, TEACHER } from './helpers'

test.describe('Devoirs', () => {
  test('le menu nav conduit à /devoirs après login enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/\/devoirs/)
  })

  test('la vue /devoirs rend le contenu principal sans erreur', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // L'app-shell doit rester visible (pas de crash / écran blanc)
    await expect(page.locator('#app-shell, .app-shell, .app-columns').first()).toBeVisible()
    // Aucune erreur serveur non gérée
    await expect(page.locator('text=/erreur serveur|500|internal server error/i')).toHaveCount(0)
  })

  test('un utilisateur non authentifié voit le formulaire de login en accédant à /devoirs', async ({ page }) => {
    // Accès direct sans session → la guard doit afficher le formulaire de connexion
    await page.goto('/devoirs')
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })
})
