import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Test E2E : Controle d'acces a la route /fichiers (teacher-only).
 *
 * La route guard dans router/index.ts verifie localStorage['cc_session'].type
 * et redirige vers /dashboard si le role est insuffisant.
 */
test.describe("Controle d'acces : route /fichiers (enseignant uniquement)", () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("un etudiant accedant a /fichiers est redirige vers le dashboard", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tentative d'acces direct a la route protegee
    await page.goto('/#/fichiers')

    // La route guard (requiredRole: 'teacher') doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 })
    await expect(page).not.toHaveURL(/fichiers/)
  })

  test("un enseignant peut acceder a la page /fichiers", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await page.goto('/#/fichiers')

    // L'enseignant ne doit pas etre redirige
    await expect(page).toHaveURL(/fichiers/, { timeout: 5_000 })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 5_000 })
  })
})
