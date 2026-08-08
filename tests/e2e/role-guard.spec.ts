import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, provisionStudent, STUDENT, TEACHER } from './helpers'

test.describe("Contrôle d'accès – gardes de route", () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("un étudiant est redirigé depuis /admin vers le dashboard", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/admin')
    // Le niveau étudiant (0) est inférieur au niveau admin (3) requis
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test("un étudiant est redirigé depuis /fichiers (route enseignant) vers le dashboard", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/fichiers')
    // Route meta.requiredRole: 'teacher' → étudiant redirigé
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test("un enseignant est redirigé depuis /admin vers le dashboard", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/admin')
    // Le niveau teacher (2) est inférieur au niveau admin (3) requis
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })
})
