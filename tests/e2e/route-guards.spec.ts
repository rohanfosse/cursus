import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

test.describe('Gardes de routes', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant redirigé depuis une route réservée aux enseignants', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /fichiers a requiredRole: 'teacher' — un étudiant doit être renvoyé au dashboard
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })

  test('étudiant redirigé depuis la route admin', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /admin a requiredRole: 'admin' — un étudiant doit être renvoyé au dashboard
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })
})
