import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('un enseignant peut naviguer vers les messages et voir la liste des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La sidebar doit afficher au moins un canal (donnees seedees en base)
    await expect(page.locator('.sidebar-item').first()).toBeVisible({ timeout: 15_000 })
  })

})
