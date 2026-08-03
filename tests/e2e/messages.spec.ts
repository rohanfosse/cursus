import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test('enseignant : affiche le message de bienvenue quand aucun canal n\'est sélectionné', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page.locator('#no-channel-hint, .no-channel-hint')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#no-channel-hint, .no-channel-hint')).toContainText('Bienvenue')
  })

  test('enseignant : sélectionne un canal et affiche son en-tête', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    const firstChannel = page.locator('.sidebar-item').first()
    const hasChannel = await firstChannel.isVisible({ timeout: 8_000 }).catch(() => false)
    if (!hasChannel) {
      test.skip(true, 'Aucun canal disponible dans la base de données de test')
    }
    await firstChannel.click()
    await expect(page.locator('#channel-header')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#channel-name')).toBeVisible()
    await expect(page.locator('#search-input')).toBeVisible()
  })
})
