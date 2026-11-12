import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant navigue vers Messages et voit la zone de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Le conteneur principal messages est monte
    await expect(page.locator('#messages-container, .messages-container')).toBeVisible({ timeout: 15_000 })
  })

  test('la barre de recherche de messages est accessible', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // L'input de recherche est present dans la vue messages
    const searchInput = page.locator('#search-input, .search-input[placeholder*="Recherch"]')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    // Saisir un terme de recherche ne provoque pas d'erreur
    await searchInput.fill('test')
    await expect(searchInput).toHaveValue('test')
  })

})
