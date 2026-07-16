import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test('un enseignant peut naviguer vers la section messages et voir l\'interface de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    await expect(page).toHaveURL(/\/messages/, { timeout: 10_000 })
    // La zone principale des messages doit être montée
    await expect(page.locator('#main-area, .main-area')).toBeVisible({ timeout: 10_000 })
    // Aucune erreur critique (ErrorBoundary) ne doit s'afficher
    await expect(page.getByText(/erreur critique|une erreur est survenue/i)).not.toBeVisible()
  })
})
