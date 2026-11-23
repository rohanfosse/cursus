import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('affiche la sidebar et la zone principale après navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Sidebar avec la liste des canaux doit etre presente
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 10_000 })
    // Zone principale de messagerie doit etre presente
    await expect(page.locator('#main-area')).toBeVisible()
  })

  test('la liste des canaux se charge dans la sidebar', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Au moins un canal doit etre affiche pour le compte enseignant seede
    await expect(page.locator('.sidebar-item').first()).toBeVisible({ timeout: 15_000 })
  })

})
