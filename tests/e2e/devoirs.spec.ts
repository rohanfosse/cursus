import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, SEL, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant : voit le bouton "Nouveau devoir" sur la page devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // DevoirsHeader rend un bouton "Nouveau devoir" visible uniquement pour les enseignants
    await expect(page.locator('button:has-text("Nouveau devoir"), button:has-text("Nouveau")')).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant : la grille de projets ou état vide est affiché', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // TeacherProjectHome affiche soit des cartes de projets, soit un EmptyState
    // On attend l'un ou l'autre (le chargement API peut prendre quelques secondes)
    await expect(
      page.locator('[class*="project-card"], [class*="devoir-card"], [class*="empty"], [class*="gantt"], h2').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('étudiant : voit ses devoirs ou un état vide après connexion', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    // StudentDevoirsView : affiche groupes de devoirs ou état vide
    // La page devoirs est montée et le contenu principal est visible
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    // Aucune erreur fatale — on vérifie l'absence d'écran d'erreur rouge
    await expect(page.locator('text=/erreur critique|500|fatal/i')).not.toBeVisible()
    // Et la présence d'un conteneur de contenu
    const contentArea = page.locator('#main-content, [class*="devoirs"], [class*="student"], [class*="empty"]').first()
    await expect(contentArea).toBeVisible({ timeout: 15_000 })
  })

})
