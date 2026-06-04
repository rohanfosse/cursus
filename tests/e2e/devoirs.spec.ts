import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  // Provision le compte etudiant de test une seule fois avant les tests qui
  // en ont besoin. Idempotent : si le compte existe deja (409), on ignore.
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant : la vue devoirs affiche le tableau de bord projets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // Conteneur principal toujours present (DevoirsView)
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // TeacherProjectHome affiche la barre "A traiter" quand aucun projet n'est selectionne
    await expect(page.locator('.dh-toolbar')).toBeVisible({ timeout: 15_000 })
  })

  test('etudiant : la vue devoirs se charge sans erreur', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // Le chargement se termine : la zone de contenu est visible
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 15_000 })

    // Aucun message d'erreur ne doit etre affiche
    await expect(page.locator('text=/Impossible de charger les devoirs/i')).not.toBeVisible()
  })

})
