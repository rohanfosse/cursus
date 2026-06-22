import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, TEACHER } from './helpers'

test.describe('Messages – navigation enseignant', () => {
  test('un enseignant accède à la vue messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 15_000 })
  })

  test("cliquer sur un canal ouvre la conversation et affiche l'en-tête", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Attendre que la sidebar charge au moins un canal (pas un DM)
    const firstChannel = page.locator('.sidebar-wrapper .sidebar-item:has(.channel-name)').first()
    await expect(firstChannel).toBeVisible({ timeout: 20_000 })

    await firstChannel.click()

    // L'en-tête de canal doit apparaître avec le nom et la barre de recherche
    await expect(page.locator('#channel-header')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('#channel-name')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#search-input')).toBeVisible({ timeout: 5_000 })
  })
})
