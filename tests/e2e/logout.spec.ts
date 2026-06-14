import { test, expect } from '@playwright/test'
import { TEACHER, SEL, loginAndWaitDashboard } from './helpers'

test.describe('Déconnexion', () => {

  test('efface la session et réaffiche le formulaire de login', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Ouvrir les paramètres via le bouton de la NavRail
    await page.click('button[aria-label="Paramètres du compte"]')

    // Le bouton "Se déconnecter" est dans la nav latérale du modal settings
    const logoutBtn = page.locator('.stg-nav-danger')
    await expect(logoutBtn).toBeVisible({ timeout: 10_000 })
    await logoutBtn.click()

    // Le formulaire de login doit réapparaître (LoginOverlay monté quand currentUser est null)
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })

    // La session localStorage doit être effacée
    const session = await page.evaluate(() => localStorage.getItem('cc_session'))
    expect(session).toBeNull()
  })

})
