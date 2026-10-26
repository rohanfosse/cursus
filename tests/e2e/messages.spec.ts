import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Vue Messages', () => {

  test('enseignant navigue vers Messages et voit la zone de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // La zone principale (#main-area) est toujours rendue dans MessagesView
    await expect(page.locator('#main-area')).toBeAttached({ timeout: 15_000 })
    // La sidebar avec la liste des canaux reste visible
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 10_000 })
  })

  test('navigation depuis Messages retour vers Dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await navigateTo(page, 'dashboard')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
