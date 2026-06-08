import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, provisionStudent, STUDENT } from './helpers'

test.describe('Parcours étudiant', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant peut se connecter et accéder au dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeAttached()
  })

  test("la route /admin est inaccessible à un étudiant et redirige vers /dashboard", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/admin')
    // router/index.ts:89 — guard redirige vers /dashboard si requiredRole non satisfait
    await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 })
  })

  test("un étudiant peut naviguer vers la vue devoirs", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area, .devoirs-content')).toBeVisible({ timeout: 10_000 })
  })
})
