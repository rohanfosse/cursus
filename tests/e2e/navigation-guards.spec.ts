import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Gardes de navigation (rôles)', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant redirigé vers /dashboard depuis /admin (requiredRole: admin)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // Tenter une navigation directe vers la route protégée via le hash
    await page.evaluate(() => { window.location.hash = '/admin' })
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('étudiant redirigé vers /dashboard depuis /booking (requiredRole: teacher)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.evaluate(() => { window.location.hash = '/booking' })
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
