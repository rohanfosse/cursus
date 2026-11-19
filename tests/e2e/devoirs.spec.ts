import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('etudiant voit la page devoirs apres navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La zone principale devoirs doit etre montee
    await expect(page.locator('.devoirs-area, .devoirs-content')).toBeVisible({ timeout: 15_000 })

    // Le titre "Devoirs" doit apparaitre dans l'en-tete
    await expect(page.locator('.dh-title-text, .dh-title')).toContainText('Devoirs', { timeout: 10_000 })
  })

  test('enseignant voit la vue projets sur la page devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // Le header de la vue devoirs doit etre present
    await expect(page.locator('.devoirs-area, .devoirs-content')).toBeVisible({ timeout: 15_000 })

    // Le bouton "Nouveau devoir" est reserve au prof
    await expect(page.locator('.dh-new, button:has-text("Nouveau devoir")')).toBeVisible({ timeout: 10_000 })
  })

})
