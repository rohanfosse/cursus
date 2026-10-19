import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Section Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("un enseignant navigue vers /devoirs et la vue charge correctement", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // L'en-tête de la page doit être visible (icône BookOpen + titre section)
    await expect(page.locator([
      '[data-section="devoirs"]',
      '.devoirs-header',
      'h1:has-text("Devoirs"), h1:has-text("Travaux"), h2:has-text("Devoirs")',
      'text=/devoirs|travaux|projets/i',
    ].join(', ')).first()).toBeVisible({ timeout: 10_000 })

    // Aucune erreur fatale ne doit s'afficher
    await expect(page.locator('text=/une erreur est survenue|500|crash/i')).not.toBeVisible()
  })

  test("un étudiant navigue vers /devoirs et voit sa liste de travaux", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La vue étudiant doit avoir chargé son contenu (liste ou état vide)
    await expect(page.locator([
      '[data-testid="devoirs-list"]',
      '.devoir-card',
      '.student-devoirs',
      'text=/devoir|rendu|livrable|aucun|à rendre/i',
    ].join(', ')).first()).toBeVisible({ timeout: 15_000 })
  })

})
