import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un etudiant connecte voit la page devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Le conteneur principal doit etre present quel que soit le nombre de devoirs
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // La vue etudiant (stats) ou l'etat vide doit etre affiche — pas d'erreur
    const studentView = page.locator('.sdv-summary-row, .dv-stats-row, text=Aucun devoir assigné')
    await expect(studentView.first()).toBeVisible({ timeout: 10_000 })
  })

})
