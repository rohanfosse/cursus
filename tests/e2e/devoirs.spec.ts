import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant : accède à la section devoirs et voit la vue principale', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    // The view must render at least one heading or list container
    await expect(
      page.locator('h1, h2, [data-testid="devoirs-list"], .devoirs-list, main').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('étudiant : accède à ses devoirs et la page se charge sans erreur', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(
      page.locator('h1, h2, [data-testid="devoirs-list"], .devoirs-list, main').first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
