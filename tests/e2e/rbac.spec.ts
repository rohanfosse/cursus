import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

/**
 * Route guards : verifie que les routes protegees redirigent les roles non autorises.
 * - /admin    : requiredRole='admin' -> etudiant redirige vers /dashboard
 * - /exam-review/:id : requiredRole='teacher' -> etudiant redirige vers /dashboard
 */
test.describe('Controles d\'acces (RBAC)', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un etudiant ne peut pas acceder a /admin', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tenter d'acceder directement a la route admin
    await page.goto('/#/admin')
    // Le guard doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // La page admin ne doit pas etre montee
    await expect(page.locator('[class*="admin-view"], [data-testid="admin"]')).not.toBeVisible({ timeout: 3_000 })
  })

  test('un etudiant ne peut pas acceder a /exam-review/:id (page enseignant)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tenter d'acceder a la correction d'examen reservee aux enseignants
    await page.goto('/#/exam-review/1')
    // Le guard doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
