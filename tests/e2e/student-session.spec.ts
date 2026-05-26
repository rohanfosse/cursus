import { test, expect } from '@playwright/test'
import {
  STUDENT,
  SEL,
  loginAndWaitDashboard,
  navigateTo,
  provisionStudent,
} from './helpers'

/**
 * Flows couverts :
 *   - Connexion étudiant → dashboard (auth étudiant jamais testé ailleurs)
 *   - Navigation vers la vue devoirs
 *   - Déconnexion → retour formulaire login
 */
test.describe('Session étudiant', () => {
  test.beforeAll(async () => {
    // Crée l'étudiant de test via l'API si inexistant (idempotent)
    await provisionStudent()
  })

  test('étudiant se connecte et arrive sur le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/)
    // L'app-shell est monté : la navigation principale est visible
    await expect(
      page.locator('#app-shell, .app-shell, .app-columns'),
    ).toBeVisible()
  })

  test('étudiant navigue vers la vue devoirs sans erreur fatale', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    // navigateTo garantit déjà que l'URL contient "devoirs"
    // La zone de contenu devoirs doit être montée
    await expect(page.locator('.devoirs-area, .devoirs-content, [class*="devoir"]').first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('étudiant se déconnecte et voit le formulaire de connexion', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Ouvrir le menu utilisateur si présent (avatar / bouton profil)
    const avatarMenu = page
      .locator(
        '[data-testid="user-menu"], [data-testid="avatar"], .avatar-button, button[aria-label*="profil" i]',
      )
      .first()
    if (await avatarMenu.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await avatarMenu.click()
      await page.waitForTimeout(400)
    }

    const logoutBtn = page
      .locator(
        [
          'button:has-text("Déconnexion")',
          'button:has-text("Deconnexion")',
          '[data-testid="logout"]',
          'button[aria-label*="déconnexion" i]',
          'button[aria-label*="logout" i]',
        ].join(', '),
      )
      .first()

    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()

    // Après déconnexion, le formulaire de login réapparaît
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })
})
