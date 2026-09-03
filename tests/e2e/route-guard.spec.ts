import { test, expect } from '@playwright/test'
import { SEL } from './helpers'

/**
 * Tests du garde de route Vue Router.
 *
 * Le router lit le role depuis localStorage (cc_session.type).
 * Sans session => role par defaut 'student'.
 * Roles : student < teacher < admin.
 *
 * Routes protegees testees :
 *   /admin   -> requiredRole: 'admin'  => redirect /dashboard si student ou teacher
 *   /booking -> requiredRole: 'teacher' => redirect /dashboard si student
 *   /exam-review/:id -> requiredRole: 'teacher' => redirect /dashboard si student
 */

/** Injecte une session fictive dans localStorage avant que la page charge */
async function injectSession(page: import('@playwright/test').Page, role: 'student' | 'teacher' | 'admin') {
  // On utilise addInitScript pour que le localStorage soit pret avant le premier JS de l'app
  await page.addInitScript((r) => {
    localStorage.setItem('cc_session', JSON.stringify({ type: r, token: 'fake-token-e2e', name: 'E2E User' }))
  }, role)
}

test.describe('Route guard - controle des acces par role', () => {

  test('student sans session : /admin est redirige vers /dashboard', async ({ page }) => {
    // Sans session, le router defaulte a role='student' qui n'a pas le droit admin
    await page.goto('/#/admin')
    // Le router doit rediriger vers /dashboard immediatement
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('session student : /admin est redirige vers /dashboard', async ({ page }) => {
    await injectSession(page, 'student')
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('session teacher : /admin est redirige vers /dashboard', async ({ page }) => {
    // teacher n'a pas le role admin
    await injectSession(page, 'teacher')
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('session student : /booking (teacher-only) est redirige vers /dashboard', async ({ page }) => {
    await injectSession(page, 'student')
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('session student : /exam-review/1 (teacher-only) est redirige vers /dashboard', async ({ page }) => {
    await injectSession(page, 'student')
    await page.goto('/#/exam-review/1')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('session teacher : /booking est accessible (pas de redirect)', async ({ page }) => {
    await injectSession(page, 'teacher')
    await page.goto('/#/booking')
    // Un teacher peut acceder a /booking : l'URL doit rester sur /booking (pas redirect /dashboard)
    await page.waitForTimeout(2_000) // Laisser le router guard s'executer
    await expect(page).not.toHaveURL(/dashboard/)
    await expect(page).toHaveURL(/booking/)
  })

  test('sans session : la page login est affichee a /', async ({ page }) => {
    // Sans session valide, / doit montrer le formulaire de login
    // (L'app detourne la redirection /dashboard et affiche login si pas de session)
    await page.goto('/')
    // Attendre le formulaire de login ou la redirection vers /dashboard suivi du login
    // L'app affiche le login soit sur '/' soit via un check de session
    const emailInput = page.locator(SEL.emailInput)
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
  })

})
