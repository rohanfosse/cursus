import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, TEACHER } from './helpers'

test.describe('Messages', () => {
  test('le menu nav conduit à /messages après login enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/\/messages/)
  })

  test('la vue messages affiche la sidebar avec la liste des channels', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // La sidebar de canaux doit être présente et visible
    const sidebar = page
      .locator('[class*="sidebar"], [class*="dm-list"], [class*="channel-list"], aside')
      .first()
    await expect(sidebar).toBeVisible({ timeout: 10_000 })
  })
})
