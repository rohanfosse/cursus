import { test, expect } from '@playwright/test'
import { TEACHER, SEL, loginAndWaitDashboard } from './helpers'

/**
 * Flow couvert : déconnexion depuis la modal de paramètres.
 *
 * Parcours :
 *   1. Connexion en tant qu'enseignant
 *   2. Ouverture de la modal paramètres via l'avatar (bas du rail de nav)
 *   3. Clic sur « Se déconnecter » → modal de confirmation
 *   4. Validation de la confirmation
 *   5. Vérification que l'écran de connexion réapparaît
 */
test.describe('Déconnexion (auth)', () => {
  test('se déconnecter depuis les paramètres ramène au formulaire de connexion', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Ouvrir la modal paramètres via le bouton avatar (bas du NavRail)
    await page.click('#nav-user-avatar')

    // Attendre que la modal de paramètres soit rendue (bouton de déconnexion visible)
    const logoutBtn = page.locator('.stg-nav-danger').first()
    await expect(logoutBtn).toBeVisible({ timeout: 10_000 })
    await logoutBtn.click()

    // Un modal de confirmation apparaît (ConfirmModal.vue)
    const confirmBtn = page.locator('.cfm-confirm').first()
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // Après déconnexion, le formulaire de connexion doit réapparaître
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })
})
