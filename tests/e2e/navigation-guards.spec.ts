import { test, expect, type Page } from '@playwright/test'

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
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
  await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })
}

test.describe('Gardiens de routes (role guards)', () => {

  test('étudiant demo : /admin (rôle admin requis) redirige vers /dashboard', async ({ page }) => {
    await startDemoSession(page, 'Etudiant')
    await page.goto('/#/admin')
    // Le router guard (beforeEach) redirige vers /dashboard si le rôle est insuffisant
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant demo : /admin (rôle admin requis) redirige vers /dashboard', async ({ page }) => {
    await startDemoSession(page, 'Enseignant')
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('étudiant demo : /booking (rôle teacher requis) redirige vers /dashboard', async ({ page }) => {
    await startDemoSession(page, 'Etudiant')
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
