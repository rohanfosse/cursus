import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test("un enseignant accède à la vue messages et voit le sidebar", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/\/messages/)
    // Le sidebar doit être présent avec au moins un nom de canal
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.channel-name').first()).toBeVisible({ timeout: 10_000 })
  })

  test("la barre de recherche est disponible dans les messages", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/\/messages/)
    const searchInput = page.locator('#search-input')
    await expect(searchInput).toBeVisible({ timeout: 8_000 })
    // Vérifier que la saisie fonctionne
    await searchInput.fill('test recherche')
    await expect(searchInput).toHaveValue('test recherche')
  })
})
