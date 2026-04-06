import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Test E2E : Vue Agenda (/agenda).
 * Route disponible pour tous les roles (pas de requiredRole dans la config router).
 */
test.describe('Vue Agenda', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("un enseignant peut naviguer vers l'agenda depuis la navigation", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await page.click('a[href*="agenda"], [data-testid="nav-agenda"], nav >> text=/agenda/i')
    await expect(page).toHaveURL(/agenda/, { timeout: 10_000 })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 5_000 })
  })

  test("un etudiant peut acceder a l'agenda par URL directe", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    await page.goto('/#/agenda')
    await expect(page).toHaveURL(/agenda/, { timeout: 10_000 })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 5_000 })
  })
})
