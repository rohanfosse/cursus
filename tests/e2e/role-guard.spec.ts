import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

/**
 * Tests du garde de route basé sur les rôles.
 *
 * Hiérarchie : student(0) < ta(1) < teacher(2) < admin(3)
 * Le prof (level 2) ne peut pas accéder à /admin (level 3 requis)
 * mais peut accéder à /booking (requiredRole: 'teacher').
 */
test.describe('Role guard', () => {

  test('un enseignant ne peut pas accéder à /admin (redirection vers /dashboard)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Tentative de navigation directe vers la page admin
    await page.goto('/#/admin')

    // Le garde de route doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Vérification complémentaire : le bouton "Admin" du NavRail est absent
    // (il n'est rendu que pour appStore.isAdmin)
    await expect(page.locator('button[aria-label="Administration"]')).not.toBeVisible()
  })

  test('un enseignant peut accéder à /booking (route teacher-only)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Navigation directe vers la page de rendez-vous réservée aux profs
    await page.goto('/#/booking')

    // L'URL doit rester sur /booking — pas de redirection
    await expect(page).toHaveURL(/booking/, { timeout: 10_000 })

    // La vue Booking doit se monter sans erreur (ErrorBoundary visible = la vue a rendu)
    // On attend la disparition du squelette de chargement ou l'apparition d'un élément stable
    await expect(page.locator('.main-area, [class*="booking"]').first()).toBeVisible({ timeout: 15_000 })
  })

})
