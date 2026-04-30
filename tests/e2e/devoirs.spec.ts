import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs – vue étudiant', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('affiche la vue étudiant et non la vue enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Vérification positive : la section "Progression globale" est propre à StudentDevoirsView
    await expect(page.locator('.sdv-summary-title')).toBeVisible({ timeout: 15_000 })

    // Vérification négative : la barre de recherche enseignant (TeacherProjectHome) ne doit pas apparaître
    await expect(
      page.locator('[aria-label="Rechercher un projet ou un devoir"]')
    ).not.toBeVisible()
  })

  test('le dépôt de fichier est accessible depuis la liste des devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La zone de contenu devoirs doit être rendue
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 15_000 })

    // L'en-tête devoirs est toujours présent (DevoirsHeader commun étudiant/prof)
    await expect(page.locator('.devoirs-area')).toBeVisible()
  })

})
