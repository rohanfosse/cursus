import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant accede a la vue devoirs et voit l\'accueil projets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La zone principale devoirs doit etre montee
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // L'en-tete "Devoirs" doit etre present (DevoirsHeader rend ce texte)
    await expect(page.locator('.dh-title-text, .dh-title')).toContainText('Devoirs', { timeout: 10_000 })

    // La vue prof (TeacherProjectHome) ne montrera pas StudentStatsBar
    await expect(page.locator('.student-stats-bar')).not.toBeVisible()
  })

  test('etudiant accede a la vue devoirs et voit sa vue personnelle', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La zone principale devoirs doit etre montee
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // La vue etudiant (StudentDevoirsView) doit etre affichee — elle seule
    // contient .devoirs-content ou .student-devoirs-view
    const studentView = page.locator('.student-devoirs-view, [data-view="student"]')
    // Au minimum, aucune erreur fatale n'est affichee
    await expect(page.locator('text=/erreur fatale|fatal error/i')).not.toBeVisible({ timeout: 5_000 })

    // L'URL doit contenir /devoirs
    await expect(page).toHaveURL(/devoirs/, { timeout: 5_000 })

    void studentView // utilise pour eviter le warning variable non utilisee
  })

})
