import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

/**
 * Tests des guards de route :
 *  - Les routes protegees par requiredRole redirigent vers /dashboard
 *    si l'utilisateur n'a pas le role requis.
 *  - Un enseignant a acces aux routes teacher-only mais pas aux routes admin.
 *  - Un etudiant ne peut acceder qu'aux routes publiques et sans requiredRole.
 */

test.describe('Guards de route (role)', () => {

  test('etudiant : acces a /fichiers redirige vers /dashboard', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tentative de navigation directe vers une route teacher-only
    await page.goto('/#/fichiers')
    // Le guard doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant : acces a /booking redirige vers /dashboard', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant : acces a /admin redirige vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await page.goto('/#/admin')
    // Le teacher n'a pas le role admin -> redirection dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant : acces a /fichiers est autorise', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await page.goto('/#/fichiers')
    // L'enseignant a le role teacher -> acces autorise
    await expect(page).toHaveURL(/fichiers/, { timeout: 10_000 })
    // La page ne doit pas afficher une erreur de type "non autorise"
    await expect(page.locator('text=/non autorisé|interdit|forbidden/i')).not.toBeVisible({ timeout: 5_000 })
  })

})
