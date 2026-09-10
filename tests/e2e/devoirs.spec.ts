import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('etudiant connecté voit la vue devoirs avec l\'en-tête', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // L'en-tête devoirs est commun à toutes les vues (DevoirsHeader)
    await expect(page.locator('.dh-title-text, .dh-title')).toBeVisible({ timeout: 15_000 })

    // L'étudiant ne voit PAS le bouton "Nouveau devoir" (réservé au prof)
    await expect(page.locator('button.dh-new, button:has-text("Nouveau devoir")')).not.toBeVisible()
  })

  test('enseignant connecté voit le bouton "Nouveau devoir"', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // Le bouton "Nouveau devoir" doit être présent dans le header prof
    await expect(page.locator('button.dh-new, button:has-text("Nouveau devoir")')).toBeVisible({ timeout: 15_000 })
  })
})
