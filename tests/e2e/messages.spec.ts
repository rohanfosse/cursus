import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('navigation vers Messages affiche la sidebar des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La sidebar principale doit être visible avec la liste des canaux
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 10_000 })

    // L'en-tête de la section "Canaux" doit être présent
    await expect(page.locator('#sidebar-channels-header')).toBeVisible({ timeout: 10_000 })

    // Au moins un canal doit apparaître dans la liste
    const channelItems = page.locator('.sidebar-scroll-list .sidebar-category')
    await expect(channelItems.first()).toBeVisible({ timeout: 10_000 })
  })

})
