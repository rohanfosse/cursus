import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('la sidebar affiche au moins un canal après connexion enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La zone de messages principale est attachée au DOM
    await expect(page.locator('#main-area, .main-area')).toBeAttached({ timeout: 10_000 })

    // Au moins un élément de canal (class .sidebar-item) est visible dans la sidebar.
    // Cela confirme que le store messages a chargé les canaux de la promo.
    await expect(page.locator('.sidebar-item').first()).toBeVisible({ timeout: 15_000 })

    // Pas d'exception capturée par le boundary "Messages"
    await expect(page.locator('.eb-fallback')).not.toBeVisible()
  })

})
