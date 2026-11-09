import { test, expect, type Page } from '@playwright/test'

/**
 * Tests du garde de route (router beforeEach).
 * On utilise le mode demo pour eviter de provisionner des comptes :
 *  - demo etudiant  → role 'student'
 *  - demo enseignant → role 'teacher'
 * Le routeur lit cc_session dans localStorage a chaque navigation et redirige
 * vers /dashboard si le role est insuffisant.
 */

async function startDemoSession(page: Page, role: 'Etudiant' | 'Enseignant'): Promise<void> {
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
  // Attendre que l'app-shell soit charge avant toute navigation directe
  await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })
}

test.describe('Controle acces par role (RBAC)', () => {

  test('un etudiant est redirige vers le dashboard sur une route teacher-only', async ({ page }) => {
    await startDemoSession(page, 'Etudiant')
    // /exam-review/:travailId a meta: { requiredRole: 'teacher' }
    await page.goto('/#/exam-review/1')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('un enseignant est redirige vers le dashboard sur la route admin-only', async ({ page }) => {
    await startDemoSession(page, 'Enseignant')
    // /admin a meta: { requiredRole: 'admin' }
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
