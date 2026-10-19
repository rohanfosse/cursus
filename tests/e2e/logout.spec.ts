import { test, expect } from '@playwright/test'
import { TEACHER, SEL, loginAndWaitDashboard } from './helpers'

test.describe('Déconnexion', () => {

  test('un enseignant connecté peut se déconnecter et retourner au login', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Ouvrir le menu utilisateur (avatar / bouton profil)
    const avatarBtn = page.locator([
      '[data-testid="user-menu"]',
      '[data-testid="avatar"]',
      '.avatar-button',
      'button[aria-label*="profil" i]',
      'button[aria-label*="menu" i]',
      'button[aria-label*="utilisateur" i]',
    ].join(', ')).first()

    await expect(avatarBtn).toBeVisible({ timeout: 10_000 })
    await avatarBtn.click()

    // Cliquer sur le bouton de déconnexion dans le menu
    const logoutBtn = page.locator([
      'button:has-text("Déconnexion")',
      'button:has-text("Deconnexion")',
      '[data-testid="logout"]',
      'button[aria-label*="déconnexion" i]',
      'button[aria-label*="logout" i]',
      'li:has-text("Déconnexion") button',
    ].join(', ')).first()

    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()

    // Après déconnexion : la page de login doit réapparaître
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 15_000 })

    // La session doit être effacée du localStorage
    const session = await page.evaluate(() => localStorage.getItem('cc_session'))
    expect(session).toBeNull()
  })

})
