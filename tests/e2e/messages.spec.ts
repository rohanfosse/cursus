import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('un etudiant voit ses canaux et peut ouvrir une conversation', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')

    // La vue messages est montée
    await expect(page.locator('#main-area, .main-area')).toBeVisible({ timeout: 10_000 })

    // Au moins un canal apparaît dans la sidebar (canaux de la promo)
    // On exclut #channel-name qui est l'en-tête du canal actif (si déjà sélectionné)
    const sidebarChannel = page.locator('.channel-name:not(#channel-name)').first()
    await expect(sidebarChannel).toBeVisible({ timeout: 15_000 })

    // Cliquer sur le premier canal de la sidebar
    await sidebarChannel.click()

    // L'en-tête du canal et la zone de saisie de message apparaissent
    await expect(page.locator('#channel-header')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 5_000 })
  })

})
