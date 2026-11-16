import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Route guards', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant redirige vers dashboard en acces direct a /admin', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Tentative d'acces direct a la route admin (reservee aux admins)
    await page.goto('/#/admin')
    // Le guard beforeEach doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant redirige vers dashboard en acces direct a /admin', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant redirige vers dashboard en acces direct a /booking (reserve prof)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
