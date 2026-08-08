import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Vérifie que le guard Vue Router (beforeEach) applique bien le contrôle d'accès
 * par rôle défini dans router/index.ts :
 *   - /admin    → requiredRole: 'admin'   (level 3)
 *   - /fichiers → requiredRole: 'teacher' (level 2)
 *
 * Un rôle insuffisant doit déclencher une redirection vers /dashboard.
 */
test.describe('Guards de navigation (contrôle d\'accès)', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant est redirigé depuis /admin vers le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // /admin exige le rôle "admin" (level 3) ; un étudiant (level 0) doit être redirigé
    await page.goto('/#/admin')

    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('un étudiant est redirigé depuis /fichiers vers le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // /fichiers exige le rôle "teacher" (level 2) ; un étudiant (level 0) doit être redirigé
    await page.goto('/#/fichiers')

    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('un enseignant peut accéder à /fichiers sans redirection', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // L'enseignant possède le rôle "teacher" (level 2) ≥ level requis → accès autorisé
    await page.goto('/#/fichiers')

    await expect(page).toHaveURL(/fichiers/, { timeout: 10_000 })
  })
})
