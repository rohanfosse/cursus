import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test.beforeEach(async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
  })

  test('navigue vers la page messages et affiche la vue', async ({ page }) => {
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 15_000 })
  })

  test('la page messages affiche un canal ou une liste de canaux', async ({ page }) => {
    await navigateTo(page, 'messages')
    // Attendre que le contenu soit charge
    // On accepte : un item de canal dans la sidebar, un canal actif, ou un
    // message de bienvenue/vide
    const hasContent = await page.locator([
      '[data-testid="channel-item"]',
      '[data-testid="channel-list"]',
      '.channel-item',
      '.channel-name',
      // Sidebar ou nav secondaire contenant des canaux
      'aside li',
      'nav li',
      // Message d'etat vide ou de bienvenue
      'text=/aucun canal|no channel|bienvenue|welcome/i',
    ].join(', ')).first().isVisible({ timeout: 15_000 }).catch(() => false)
    expect(hasContent, 'La page messages doit afficher au moins un canal ou un message d\'etat').toBe(true)
  })

  test('acces direct a /messages via URL hash fonctionne apres login', async ({ page }) => {
    // Verifier qu'on peut naviguer directement vers messages par URL
    await page.goto('/#/messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // La vue doit etre montee (pas redirigee hors de /messages)
    await expect(page.locator('#app-shell, .app-shell, .app-columns').first()).toBeVisible({ timeout: 10_000 })
  })

})
