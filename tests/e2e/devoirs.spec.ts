import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant se connecte et est redirigé vers le tableau de bord', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('étudiant accède à la page devoirs et voit la vue élève', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    // Le conteneur principal est bien monté
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    // La vue élève est affichée (accueil ou skeleton de chargement)
    await expect(page.locator('.dv-page, .devoirs-list')).toBeVisible({ timeout: 15_000 })
    // La toolbar enseignant ne doit pas s'afficher pour un étudiant
    await expect(page.locator('.dh-toolbar')).not.toBeVisible()
  })

  test('enseignant accède à la page devoirs et voit la vue enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    // La toolbar enseignant (chips "À traiter" / "Brouillons") est spécifique au prof
    await expect(page.locator('.dh-toolbar, .btn-cta')).toBeVisible({ timeout: 20_000 })
    // Le donut de progression élève ne doit pas s'afficher pour un enseignant
    await expect(page.locator('.sdv-donut')).not.toBeVisible()
  })

})
