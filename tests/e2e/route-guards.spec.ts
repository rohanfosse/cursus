import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, login, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Guards de route : contrôle d'accès par rôle
 *
 * Vérifie que le beforeEach du router (src/renderer/src/router/index.ts)
 * refuse l'accès aux routes restreintes et redirige vers /dashboard.
 *
 * Flux couverts :
 *  - Enseignant → /admin (role 'admin' requis) → dashboard
 *  - Enseignant → route inconnue (catch-all) → dashboard
 *  - Étudiant → /booking (role 'teacher' requis) → dashboard
 *  - Étudiant → /fichiers (role 'teacher' requis) → dashboard
 *  - Étudiant → /exam-review/:id (role 'teacher' requis) → dashboard
 */

test.describe('Guards de route - Enseignant', () => {

  test('acces a /admin refuse (role admin requis) → redirection dashboard', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('route inconnue → redirection dashboard (catch-all router)', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    await page.goto('/#/cette-route-nexiste-pas-xyz')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})

test.describe('Guards de route - Étudiant', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('acces a /booking refuse (role teacher requis) → redirection dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('acces a /fichiers refuse (role teacher requis) → redirection dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('acces a /exam-review refuse (role teacher requis) → redirection dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/exam-review/1')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
