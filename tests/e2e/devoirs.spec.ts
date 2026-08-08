import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test("un étudiant voit le titre 'Devoirs' après navigation vers la section", async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Le header de la vue devoirs affiche le texte "Devoirs"
    await expect(page.locator('.dh-title-text')).toContainText('Devoirs', { timeout: 15_000 })
  })

  test("un enseignant accède à la vue devoirs et le contenu se charge", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La vue teacher est montée : le bouton "Nouveau" du header enseignant doit être visible
    await expect(page.locator('.dh-new')).toBeVisible({ timeout: 15_000 })
  })

})
