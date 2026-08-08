import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Administration – contrôle d\'accès', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant accédant à /admin est redirigé vers le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tentative d'accès direct à la route protégée (requiredRole: 'admin')
    await page.goto('/#/admin')

    // Le beforeEach guard doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('le bouton Admin n\'est pas visible dans la NavRail pour un étudiant', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // v-if="appStore.isAdmin" dans NavRail : le bouton ne doit pas exister
    await expect(
      page.locator('button[aria-label="Administration"]')
    ).not.toBeVisible()
  })

  test('la page admin affiche les 3 onglets avec une session admin', async ({ page }) => {
    // Injecter une session admin avant le chargement de la page pour bypasser
    // le route guard (qui lit localStorage, sans valider le token).
    await page.addInitScript(() => {
      localStorage.setItem('cc_session', JSON.stringify({
        token: '__e2e_admin_token__',
        id: 9999,
        name: 'E2E Admin',
        email: 'e2e-admin@test.fr',
        type: 'admin',
        promoId: null,
      }))
    })

    // Mocker les appels API pour éviter que les 401 du token fictif
    // ne déclenchent un logout automatique via cursus:auth-expired.
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: {} }),
      })
    )

    await page.goto('/#/admin')

    // La nav d'onglets doit contenir les 3 entrées définies dans AdminView
    const tabs = page.locator('nav[aria-label="Sections admin"] button.adm-tab')
    await expect(tabs).toHaveCount(3, { timeout: 10_000 })
    await expect(tabs.nth(0)).toContainText('Statistiques')
    await expect(tabs.nth(1)).toContainText('Utilisateurs')
    await expect(tabs.nth(2)).toContainText('Modules')
  })

})
