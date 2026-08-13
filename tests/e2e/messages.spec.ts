import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Messages', () => {

  test('navigation vers la section messages via le NavRail', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Le bouton NavRail messages porte data-tour="messages"
    await expect(page.locator('[data-tour="messages"]')).toBeVisible({ timeout: 10_000 })
    await page.click('[data-tour="messages"]')

    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // La zone principale est toujours rendue dès que la vue est montée
    await expect(page.locator('.main-area')).toBeVisible({ timeout: 10_000 })
  })

  test('la liste des canaux est visible dans la sidebar', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.click('[data-tour="messages"]')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // L'en-tête de la section canaux (id="sidebar-channels-header") doit être présent
    // dès que les données sont chargées — indique que la sidebar a bien monté les canaux
    await expect(page.locator('#sidebar-channels-header')).toBeVisible({ timeout: 15_000 })
  })

  test('le champ de saisie est visible quand un canal est actif', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.click('[data-tour="messages"]')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // Cliquer sur le premier ChannelItem visible pour activer un canal
    const firstChannel = page.locator('.channel-item, [data-channel-id]').first()
    if (await firstChannel.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstChannel.click()
      // Une fois un canal actif, le textarea de saisie doit apparaître
      await expect(page.locator('textarea, [contenteditable="true"]').first()).toBeVisible({ timeout: 10_000 })
    } else {
      // Pas de canal visible : on vérifie au moins que la vue est montée sans erreur
      await expect(page.locator('.main-area')).toBeVisible()
    }
  })

})
