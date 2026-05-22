import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

/**
 * Flows couverts : accès à la section Devoirs selon le rôle.
 *
 * Parcours étudiant :
 *   1. Provisionnement du compte étudiant de test via l'API
 *   2. Connexion en tant qu'étudiant
 *   3. Fermeture de l'assistant d'intégration (onboarding) s'il apparaît
 *   4. Navigation directe vers /#/devoirs
 *   5. Vérification que la zone devoirs charge la vue étudiant (pas la vue prof)
 *
 * Parcours enseignant :
 *   1. Connexion en tant qu'enseignant
 *   2. Navigation directe vers /#/devoirs
 *   3. Vérification que la zone devoirs charge la vue enseignant (pas la vue étudiant)
 */
test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant voit sa vue devoirs sans les éléments de gestion enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Fermer l'assistant d'intégration s'il apparaît (compte nouvellement créé)
    const skipBtn = page.locator('button:has-text("Passer"), button:has-text("Ignorer"), button:has-text("Fermer")').first()
    if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skipBtn.click()
    }

    // Navigation directe pour éviter les éventuels overlays bloquants
    await page.goto('/#/devoirs')
    await expect(page).toHaveURL(/#\/devoirs/, { timeout: 10_000 })

    // La zone principale des devoirs doit être rendue
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // Les éléments spécifiques à l'interface enseignant (toolbar « À traiter ») ne doivent pas apparaître
    await expect(page.locator('.dh-toolbar')).not.toBeVisible()
  })

  test('un enseignant voit sa vue projets sans les éléments de suivi étudiant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    await page.goto('/#/devoirs')
    await expect(page).toHaveURL(/#\/devoirs/, { timeout: 10_000 })

    // La zone principale des devoirs doit être rendue
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // Les éléments spécifiques à la vue étudiant (récapitulatif personnel) ne doivent pas apparaître
    await expect(page.locator('.sdv-summary-row')).not.toBeVisible()
  })
})
