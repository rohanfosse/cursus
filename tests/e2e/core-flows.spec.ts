import { test, expect } from '@playwright/test'
import { TEACHER, SEL, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Parcours critiques non couverts par les tests existants :
 *   - auth    : déconnexion via le menu paramètres
 *   - devoirs : enseignant accède à la vue devoirs
 *   - messages: enseignant accède aux messages et voit la liste des canaux
 */

test.describe('Déconnexion', () => {

  test('après connexion, la déconnexion via paramètres renvoie au login', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Ouvrir la modal paramètres via le bouton avatar du NavRail
    await page.click('#nav-user-avatar, button[aria-label*="Paramètres" i]')

    // Attendre que la modal charge (lazy-loaded)
    await page.waitForSelector('.stg-layout', { timeout: 10_000 })

    // Naviguer vers l'onglet "Mon compte"
    const compteTab = page.locator('.stg-nav-item, .stg-mobile-tab').filter({ hasText: /mon compte/i })
    await expect(compteTab.first()).toBeVisible({ timeout: 5_000 })
    await compteTab.first().click()

    // Cliquer sur le bouton Déconnexion
    const logoutBtn = page.locator('button').filter({ hasText: /deconnexion/i })
    await expect(logoutBtn.first()).toBeVisible({ timeout: 5_000 })
    await logoutBtn.first().click()

    // Après déconnexion : retour sur le formulaire de login
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })

})

test.describe('Devoirs', () => {

  test('enseignant accède à la vue devoirs et voit la zone de contenu', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La zone devoirs doit être montée
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // Le contenu devoirs doit être rendu (conteneur principal)
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })
  })

})

test.describe('Messages', () => {

  test('enseignant accède aux messages et voit au moins un canal dans la sidebar', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La sidebar est toujours présente; au moins un canal doit y être listé
    const channelName = page.locator('.sidebar-wrapper .channel-name')
    await expect(channelName.first()).toBeVisible({ timeout: 15_000 })
  })

})
