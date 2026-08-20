import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Authentification étudiant', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('connecte un étudiant et affiche le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('redirige un étudiant qui accède à une route réservée aux enseignants', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /fichiers is teacher-only (requiredRole: 'teacher' in router guard)
    await page.goto('/#/fichiers')
    await page.waitForURL(/\/dashboard/, { timeout: 8_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
