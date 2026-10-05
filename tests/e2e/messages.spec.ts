import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant peut accéder à la vue messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Le conteneur racine de MessagesView (#main-area) doit être monté
    await expect(page.locator('#main-area, .main-area')).toBeAttached({ timeout: 15_000 })
    // Et l'URL doit contenir /messages
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
  })

  test('la vue messages propose un champ de recherche', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Une fois un canal actif (auto-sélectionné au chargement), le header s'affiche
    // avec son champ de recherche.
    await expect(page.locator('#search-input, input[placeholder*="Rechercher"]')).toBeAttached({
      timeout: 15_000,
    })
  })

})
