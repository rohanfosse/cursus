import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Routes protegees par requiredRole dans le router :
 *  /admin    → requiredRole: 'admin'
 *  /fichiers → requiredRole: 'teacher'
 *  /booking  → requiredRole: 'teacher'
 *
 * Le guard redirige vers /dashboard si le role est insuffisant.
 */
test.describe('Garde de route par role', () => {

  test('etudiant est redirige vers /dashboard depuis /admin', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tenter d'acceder a la route admin (requiredRole: 'admin')
    await page.goto('/#/admin')
    // Le guard doit rediriger immediatement vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // La page admin ne doit pas etre montee
    await expect(page.locator('.admin-view, [data-testid="admin-view"]')).not.toBeVisible()
  })

  test('etudiant est redirige vers /dashboard depuis /fichiers', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tenter d'acceder a la route fichiers (requiredRole: 'teacher')
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant accede a /fichiers sans redirection', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await page.goto('/#/fichiers')
    // Le teacher a le role requis : il reste sur /fichiers
    await expect(page).toHaveURL(/fichiers/, { timeout: 10_000 })
  })

})
