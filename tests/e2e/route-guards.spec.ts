import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

/**
 * Vérifie que le garde de route (router.beforeEach) redirige bien les
 * utilisateurs qui n'ont pas le rôle requis pour une route protégée.
 */
test.describe('Gardes de route', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant accédant à /admin est redirigé vers /dashboard', async ({ page }) => {
    // Le compte enseignant a le rôle "teacher", pas "admin"
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Tentative d'accès direct à la route admin
    await page.goto('/#/admin')
    // Le garde doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('étudiant accédant à /fichiers (teacher-only) est redirigé vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // /fichiers requiert le rôle "teacher"
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('étudiant accédant à /booking (teacher-only) est redirigé vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // /booking requiert le rôle "teacher"
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
