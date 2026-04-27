import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un enseignant accède à la vue devoirs professeur', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/devoirs')

    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // .dh-toolbar ("À traiter") est exclusif à TeacherProjectHome ;
    // si la base est vide pour cette promo, le bouton EmptyState "Créer un devoir" est affiché.
    await expect(
      page.locator('.dh-toolbar').or(page.locator('button', { hasText: 'Créer un devoir' })),
    ).toBeVisible({ timeout: 12_000 })

    // L'input de recherche propre à la vue étudiant ne doit pas être présent
    await expect(page.locator('.sdv-search-input')).not.toBeVisible()
  })

  test('un étudiant accède à la vue devoirs étudiant', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/devoirs')

    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // La toolbar prof "À traiter" ne doit pas apparaître pour un étudiant
    await expect(page.locator('.dh-toolbar')).not.toBeVisible({ timeout: 5_000 })

    // La zone de contenu étudiant est montée (liste, squelette ou état vide)
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })
  })
})
