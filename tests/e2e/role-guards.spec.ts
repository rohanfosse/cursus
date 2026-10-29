import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

/**
 * Verifie les guards de role definis dans le router :
 *  - Les routes reservees aux enseignants redirigent un etudiant vers /dashboard
 *  - Les routes admin redirigent un non-admin vers /dashboard
 *  - Un enseignant peut acceder a ses routes specifiques
 */
test.describe('Gardes de role (router guards)', () => {

  async function startDemoStudent(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button:has-text("Etudiant")'),
    ])
    expect(res.ok()).toBe(true)
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })
  }

  test('etudiant demo redirige vers /dashboard quand il tente /admin', async ({ page }) => {
    await startDemoStudent(page)
    await page.goto('/#/admin')
    // Le guard beforeEach doit bloquer et rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // La page admin ne doit pas etre visible
    await expect(page.locator('text=/Administration|admin-panel/i')).not.toBeVisible({ timeout: 3_000 })
  })

  test('etudiant demo redirige vers /dashboard quand il tente /booking', async ({ page }) => {
    await startDemoStudent(page)
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant demo redirige vers /dashboard quand il tente /exam-review/1', async ({ page }) => {
    await startDemoStudent(page)
    await page.goto('/#/exam-review/1')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant peut acceder a /booking sans etre redirige', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/booking')
    // L'enseignant ne doit PAS etre redirige vers /dashboard
    await page.waitForTimeout(1_500)
    expect(page.url()).toMatch(/booking/)
  })

})
