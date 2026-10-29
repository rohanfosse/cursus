import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant navigue vers la section devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    // La zone principale des devoirs doit etre montee
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
  })

  test('vue enseignant affiche le contenu devoirs (pas la vue depot etudiant)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    // Le formulaire de depot de fichier ne doit pas etre visible pour un enseignant
    await expect(page.locator('[data-testid="deposit-form"], .deposit-form')).not.toBeVisible()
    // La section devoirs est chargee avec le contenu enseignant
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })
  })

  test('demo etudiant voit la section devoirs avec la vue etudiant', async ({ page }) => {
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    const [startRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.click('button:has-text("Etudiant")'),
    ])
    expect(startRes.ok()).toBe(true)
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })

    // Naviguer vers devoirs
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    // La vue etudiant est montee (composant StudentDevoirsView contenu dans .devoirs-content)
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })
  })

})
