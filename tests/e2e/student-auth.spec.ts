import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

test.describe('Authentification étudiant et gardes de route', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('Connecte un étudiant et affiche le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/)
  })

  test("Redirige un étudiant vers le dashboard si /admin est demandé", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test("Redirige un étudiant vers le dashboard si /booking est demandé", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
