import { test, expect } from '@playwright/test'
import { provisionStudent, loginAndWaitDashboard, STUDENT } from './helpers'

test.describe("Contrôle d'accès Admin", () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("étudiant redirigé hors de /admin (rôle insuffisant)", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // requiredRole: 'admin' — un étudiant doit être renvoyé au dashboard
    await page.goto('/#/admin')
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 10_000 })
    // L'interface admin ne doit pas être montée
    await expect(page.locator('.admin-view')).not.toBeVisible()
  })

  test("accès à /admin sans session redirige hors de la route", async ({ page }) => {
    // Contexte vierge : aucun cc_session en localStorage
    await page.goto('/#/admin')
    // Le garde de route doit empêcher l'affichage de l'administration
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 10_000 })
    await expect(page.locator('.admin-view')).not.toBeVisible()
  })
})
