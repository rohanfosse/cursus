import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant navigue vers messages et voit la zone principale de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La zone principale #main-area est toujours rendue une fois sur /messages
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })

})
