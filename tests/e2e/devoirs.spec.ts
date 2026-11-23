import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant voit la vue devoirs après navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // DevoirsHeader rend le titre "Devoirs" (DevoirsView toujours present)
    await expect(page.locator('.dh-title-text')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible()
  })

  test('étudiant accède à ses devoirs après navigation', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Header toujours present, quel que soit le contenu
    await expect(page.locator('.dh-title-text')).toBeVisible({ timeout: 10_000 })

    // StudentDevoirsView converge vers : accueil projet (.dv-page), état vide ou squelettes
    // On attend que l'un de ces états soit visible (fin du chargement ou donnees chargees)
    await expect(
      page.locator('.dv-page, .devoirs-list, .empty-state'),
    ).toBeVisible({ timeout: 15_000 })
  })

})
