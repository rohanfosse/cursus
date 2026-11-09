import { test, expect, type Page } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

/** Supprime les modales bloquantes (RGPD + onboarding) avant le premier chargement. */
async function suppressBlockingModals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('cc_privacy_seen', '1')
    localStorage.setItem('cc_onboarding_seen', '1')
  })
}

/** Demarre une session demo et attend le dashboard. */
async function startDemoAndWait(page: Page, role: 'Etudiant' | 'Enseignant'): Promise<void> {
  await suppressBlockingModals(page)
  await page.goto('/#/demo')
  await page.waitForSelector(`button:has-text("${role}")`, { timeout: 20_000 })
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST',
      { timeout: 20_000 },
    ),
    page.click(`button:has-text("${role}")`),
  ])
  expect(res.ok()).toBe(true)
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })
  await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })
  await page.waitForTimeout(500)
}

test.describe('Devoirs', () => {

  test('un enseignant voit la vue devoirs et le bouton Nouveau devoir', async ({ page }) => {
    await suppressBlockingModals(page)
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    // Bouton CTA reserve au prof
    await expect(page.locator('button:has-text("Nouveau devoir")')).toBeVisible({ timeout: 10_000 })
  })

  test('un etudiant demo voit la zone devoirs sans le bouton Nouveau devoir', async ({ page }) => {
    await startDemoAndWait(page, 'Etudiant')
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    // Le bouton "Nouveau devoir" est interdit aux etudiants
    await expect(page.locator('button:has-text("Nouveau devoir")')).not.toBeVisible()
  })

})
