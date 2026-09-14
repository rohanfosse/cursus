import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Vue Messages', () => {
  test("Un enseignant accède à la messagerie et voit la zone principale", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/)
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })
})
