import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, provisionStudent, STUDENT, TEACHER } from './helpers'

test.describe('Controle acces par role', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un etudiant est redirige vers le dashboard en tentant d\'acceder a /fichiers (teacher only)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('un enseignant peut acceder a la route /fichiers', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/fichiers/, { timeout: 10_000 })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 })
  })
})
