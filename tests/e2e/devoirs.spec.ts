import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {
  test('enseignant navigue vers les devoirs et voit la vue projets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // La div racine de DevoirsView doit être rendue
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })
})
