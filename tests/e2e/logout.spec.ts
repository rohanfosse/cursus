import { test, expect } from '@playwright/test'
import { TEACHER, SEL, loginAndWaitDashboard } from './helpers'

test.describe('Déconnexion', () => {

  test('enseignant peut se déconnecter depuis les paramètres', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Ouvrir la modale paramètres via l'avatar
    await page.click('#nav-user-avatar')

    // Le bouton "Se déconnecter" est dans la nav gauche de la modale
    const logoutBtn = page.locator('button.stg-nav-danger, button:has-text("Se déconnecter")')
    await expect(logoutBtn.first()).toBeVisible({ timeout: 8_000 })
    await logoutBtn.first().click()

    // Après déconnexion : retour sur la page de login
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })

})
