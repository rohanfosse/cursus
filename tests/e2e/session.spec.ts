import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, SEL, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Gestion de session', () => {

  test('se déconnecter via les paramètres ramène au login', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Ouvrir la modale de paramètres via le bouton avatar en bas du rail
    await page.click('#nav-user-avatar')

    // Attendre que la modale de paramètres soit visible (bouton logout dans la nav latérale)
    await page.waitForSelector('button.stg-nav-danger', { timeout: 10_000 })

    // Cliquer sur "Se deconnecter"
    await page.click('button.stg-nav-danger')

    // Après déconnexion le formulaire de login doit réapparaître
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })

  test("un étudiant est redirigé vers le dashboard s'il tente une route enseignant", async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // /booking est protégé par meta: { requiredRole: 'teacher' }
    await page.goto('/#/booking')

    // Le guard beforeEach doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
