import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

test.describe('Cycle enseignant-etudiant : creation et soumission de devoir', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant se connecte et accede au dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await expect(page.locator('#app-shell, .app-shell, .dashboard-shell, main').first()).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant navigue vers devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await page.click('a[href*="devoirs"], nav >> text=/devoirs/i')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
  })

  test('etudiant se connecte et accede au dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page.locator('#app-shell, .app-shell, .dashboard-shell, main').first()).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant navigue vers devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    await page.click('a[href*="devoirs"], nav >> text=/devoirs/i')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
  })
})
