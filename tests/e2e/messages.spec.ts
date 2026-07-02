import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test('enseignant accede a la vue messages et voit la zone principale', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // #main-area est l'element racine de MessagesView, present quelque soit le canal actif
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })
})
