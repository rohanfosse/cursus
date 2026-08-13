import { test, expect } from '@playwright/test'
import { TEACHER, SEL, loginAndWaitDashboard } from './helpers'

test.describe('Devoirs', () => {

  test('navigation vers les devoirs via le NavRail', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Le bouton NavRail devoirs porte data-tour="devoirs"
    await expect(page.locator('[data-tour="devoirs"]')).toBeVisible({ timeout: 10_000 })
    await page.click('[data-tour="devoirs"]')

    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test('déconnexion via les paramètres du compte', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Le bouton avatar (id="nav-user-avatar") ouvre la modale Paramètres
    await page.click('#nav-user-avatar')

    // Cliquer sur "Se deconnecter" dans la barre de navigation des paramètres
    await page.click('button:has-text("Se deconnecter")', { timeout: 10_000 })

    // Une boîte de confirmation apparaît — confirmer via le bouton .cfm-confirm
    await page.click('.cfm-confirm', { timeout: 5_000 })

    // Après logout, on doit retrouver le formulaire de connexion
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })

})
