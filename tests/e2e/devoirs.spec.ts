import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test.beforeAll(async () => {
    // S'assurer que le compte étudiant de test existe avant la suite
    await provisionStudent()
  })

  test('étudiant : la page devoirs affiche la vue étudiante', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // La zone principale devoirs est toujours présente
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // Vue étudiant : soit l'accueil (donut + grille projets), soit l'état vide.
    // Ces trois éléments sont exclusifs à la branche StudentDevoirsView.
    const studentUI = page
      .locator('.sdv-summary-row, .dv-proj-grid, .devoirs-list')
      .or(page.getByText(/Aucun devoir assigné/i))

    await expect(studentUI.first()).toBeVisible({ timeout: 15_000 })
  })

  test('enseignant : la page devoirs affiche la vue enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // La vue étudiant (donut résumé, classe sdv-summary-row) ne doit PAS
    // apparaître pour un enseignant. C'est le signal que la branche correcte
    // (TeacherProjectHome) est rendue.
    await expect(page.locator('.sdv-summary-row')).not.toBeVisible()
  })

})
