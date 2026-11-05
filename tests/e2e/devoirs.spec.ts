import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant : la vue /devoirs se charge et affiche la zone devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // navigateTo verifie deja l'URL ; on confirme que le composant racine est monte
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant : apres login la vue /devoirs affiche sa liste de travaux', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    // La vue etudiant affiche soit un squelette (.devoirs-list) soit du contenu (.es = EmptyState ou groupes)
    await expect(page.locator('.devoirs-area .devoirs-list, .devoirs-area .es')).toBeVisible({ timeout: 10_000 })
  })

})
