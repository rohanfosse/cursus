import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

/**
 * Vérifie que les gardiens de route (router.beforeEach) bloquent l'accès aux
 * routes protégées par un rôle insuffisant.
 *
 * Hiérarchie : student(0) < ta(1) < teacher(2) < admin(3)
 * Un enseignant (level 2) ne peut pas atteindre /admin (level 3 requis).
 */
test.describe('Gardiens de route (role-guards)', () => {

  test('un enseignant redirigé vers /dashboard sur tentative d\'accès à /admin', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Navigation directe vers la route admin via le hash-router
    await page.goto('/#/admin')

    // Le routeur doit intercepter et rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // La div .admin-view ne doit pas être dans le DOM
    await expect(page.locator('.admin-view')).not.toBeAttached({ timeout: 5_000 })
  })

  test('un enseignant peut toujours accéder à /devoirs après une tentative bloquée', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Tentative d'accès à une route interdite
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // La navigation vers une route autorisée fonctionne ensuite normalement
    await page.goto('/#/devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
  })

})
