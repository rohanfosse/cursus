import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant : /devoirs se charge et affiche le bouton Nouveau devoir', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    // DevoirsHeader rend ce bouton uniquement pour les enseignants (v-if="appStore.isTeacher")
    await expect(page.locator('button.dh-new')).toBeVisible({ timeout: 5_000 })
  })

  test('étudiant demo : /devoirs se charge, le bouton Nouveau devoir est absent', async ({ page }) => {
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    const [startRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button:has-text("Etudiant")'),
    ])
    expect(startRes.ok()).toBe(true)
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
    await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })

    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    // Le bouton Nouveau est absent pour un étudiant
    await expect(page.locator('button.dh-new')).not.toBeVisible()
  })

})
