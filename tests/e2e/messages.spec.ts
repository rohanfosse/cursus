import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test('la sidebar affiche la liste des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La sidebar est toujours présente dans l'app-shell une fois connecté
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 10_000 })
    // Au moins un canal (.sidebar-item) doit être visible
    await expect(page.locator('#sidebar .sidebar-item').first()).toBeVisible({ timeout: 10_000 })
  })

  test('cliquer sur un canal affiche le header de canal', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    const firstChannel = page.locator('#sidebar .sidebar-item').first()
    await expect(firstChannel).toBeVisible({ timeout: 10_000 })
    await firstChannel.click()

    // Le header du canal apparaît avec le nom du canal sélectionné
    await expect(page.locator('#channel-header')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('#channel-name')).toBeVisible({ timeout: 10_000 })
  })
})
