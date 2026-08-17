import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages – navigation', () => {
  test('enseignant : navigue vers /messages et voit la zone de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La zone principale de chat est montée (racine de MessagesView)
    await expect(page.locator('#main-area, .main-area')).toBeVisible({ timeout: 15_000 })

    // La barre de recherche globale est accessible (input toujours présent dans l'header du canal)
    // On attend qu'un canal soit auto-sélectionné puis que l'input apparaisse
    await expect(page.locator('#search-input')).toBeVisible({ timeout: 15_000 })
  })
})
