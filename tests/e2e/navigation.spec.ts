import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Navigation et garde de routes', () => {
  test("une route inconnue redirige vers le dashboard", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/cette-route-nexiste-pas')
    // Le catch-all route /* → redirect /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 })
  })

  test("la déconnexion ramène vers le formulaire de login", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // Chercher le bouton avatar / menu utilisateur dans l'app shell
    const avatarBtn = page.locator([
      'button[class*="avatar"]',
      '.avatar-btn',
      '[aria-label*="compte" i]',
      '[aria-label*="profil" i]',
      'button[aria-label="Menu utilisateur"]',
    ].join(', ')).first()
    await expect(avatarBtn).toBeVisible({ timeout: 8_000 })
    await avatarBtn.click()
    // Cliquer sur "Déconnexion" dans le menu qui apparaît
    const logoutBtn = page.getByText(/^Déconnexion$/i)
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()
    // Après déconnexion le formulaire de login doit réapparaître
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
  })
})
