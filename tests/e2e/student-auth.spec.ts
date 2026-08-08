/**
 * Tests E2E – Authentification étudiant
 *
 * Flows couverts :
 *   1. Connexion étudiant → tableau de bord (#app-shell visible, URL /dashboard)
 *   2. Déconnexion via Paramètres → retour au formulaire de login
 *
 * Prérequis : compte STUDENT provisionné via API avant les tests.
 *
 * Séquence de déconnexion :
 *   #nav-user-avatar  →  .stg-nav-danger ("Se deconnecter")  →  .cfm-confirm (confirmation)
 */
import { test, expect } from '@playwright/test'
import { STUDENT, SEL, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Authentification étudiant', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant peut se connecter et accéder au tableau de bord', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    await expect(page.locator('#app-shell')).toBeVisible()
    await expect(page).toHaveURL(/dashboard/)
  })

  test('un étudiant peut se déconnecter via les paramètres', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Ouvrir la modale Paramètres via le bouton avatar dans la NavRail
    await page.locator('#nav-user-avatar').click()

    // Cliquer sur "Se deconnecter" dans la navigation latérale de la modale
    const logoutBtn = page.locator('.stg-nav-danger')
    await expect(logoutBtn).toBeVisible({ timeout: 10_000 })
    await logoutBtn.click()

    // Une modale de confirmation apparaît (.cfm-confirm = bouton primaire de ConfirmModal)
    const confirmBtn = page.locator('.cfm-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // Après déconnexion, le formulaire de login est à nouveau visible
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 15_000 })
  })
})
