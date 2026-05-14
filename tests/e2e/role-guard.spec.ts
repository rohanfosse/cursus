import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Verifies that the Vue Router beforeEach guard (role-based) correctly
 * redirects users who lack the required role, covering the teacher→/admin
 * and student→teacher-only routes paths.
 */
test.describe('Garde de routes par rôle', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant : /admin redirige vers /dashboard (rôle admin requis)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // Teacher role is 'teacher', not 'admin' — guard must redirect
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('étudiant : /booking redirige vers /dashboard (rôle enseignant requis)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('étudiant : /fichiers redirige vers /dashboard (rôle enseignant requis)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
