import { test, expect } from '@playwright/test'
import { STUDENT, TEACHER, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Couverture : auth étudiant (manquant dans auth.spec.ts) + navigation devoirs.
 *
 * Prérequis : serveur démarré, base seedée avec promo id=1.
 * La fixture STUDENT est provisionnée via l'API avant la suite.
 */
test.describe('Devoirs - flux étudiant', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant peut se connecter et accéder au dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // Le shell du dashboard est monté
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 10_000 })
    // La session localStorage indique bien le rôle étudiant
    await expect.poll(async () => {
      return await page.evaluate(() => {
        try {
          const raw = localStorage.getItem('cc_session')
          if (!raw) return null
          return JSON.parse(raw).type
        } catch { return null }
      })
    }, { timeout: 10_000 }).toBe('student')
  })

  test('un étudiant peut naviguer vers la page devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    // La zone principale devoirs doit être rendue
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 15_000 })
  })
})

/**
 * Couverture : vue devoirs côté enseignant (accès + rendu du shell).
 */
test.describe('Devoirs - flux enseignant', () => {
  test('un enseignant peut naviguer vers la page devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
  })
})
