import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant : /messages se charge et affiche la zone principale', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })

  test('sans canal actif, l\'état vide Bienvenue est affiché', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // Effacer l'état de navigation persisté pour garantir qu'aucun canal n'est restauré
    await page.evaluate(() => localStorage.removeItem('cc_nav_state'))
    await page.goto('/#/messages')
    await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })
    await expect(page.locator('#no-channel-hint')).toBeVisible({ timeout: 10_000 })
  })

})
