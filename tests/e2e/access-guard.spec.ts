import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Controle d\'acces par role', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un etudiant est redirige depuis une route enseignant vers le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tentative d'acces direct a une route restreinte au role enseignant (/fichiers)
    await page.goto('/#/fichiers')

    // Le guard router doit rejeter l'acces et renvoyer vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
