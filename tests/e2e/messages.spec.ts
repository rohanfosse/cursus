import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant accède à la page messages et voit la zone principale', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La zone de contenu principale doit être montée
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })

    // Sans canal sélectionné : hint "choisissez un canal" ou header de canal
    const hint   = page.locator('#no-channel-hint')
    const header = page.locator('#channel-header')
    await expect(hint.or(header)).toBeVisible({ timeout: 8_000 })
  })

})
