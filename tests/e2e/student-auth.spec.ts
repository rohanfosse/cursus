import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

test.describe('Authentification étudiant + gardes de route RBAC', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('connecte un étudiant et affiche le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('bloque l\'accès étudiant à /admin (rôle insuffisant)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /admin requiert meta.requiredRole: 'admin' — le guard redirige vers /dashboard
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })

  test('bloque l\'accès étudiant à /booking (route enseignant)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /booking requiert meta.requiredRole: 'teacher' — le guard redirige vers /dashboard
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })

  test('bloque l\'accès étudiant à /fichiers (route enseignant)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /fichiers requiert meta.requiredRole: 'teacher'
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })
})
