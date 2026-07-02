import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

test.describe('Garde-fous de routes (role-based guards)', () => {
  test.beforeEach(async () => {
    await provisionStudent()
  })

  test('etudiant redirige vers /dashboard quand il tente /admin', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // Tentative d'acces direct a la route admin (requiredRole: 'admin')
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant redirige vers /dashboard quand il tente /booking (enseignant seulement)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // Tentative d'acces direct a la route booking (requiredRole: 'teacher')
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
