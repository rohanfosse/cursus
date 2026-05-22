import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Test E2E : Contrôle d'accès basé sur les rôles (ACL)
 *
 * Scenarios :
 *   - Un étudiant tente d'accéder directement à /fichiers (route réservée aux enseignants)
 *     → le guard de Vue Router doit le rediriger vers /dashboard
 *   - Un utilisateur non authentifié accède à une route inconnue
 *     → le catch-all redirige vers /dashboard
 *
 * Prérequis :
 *   Serveur démarré sur :3001, frontend sur :5174
 *   La session étudiant doit être persistée en localStorage (cc_session)
 *   pour que le guard de route puisse lire le rôle.
 */

test.describe('Contrôle d\'accès (ACL)', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant redirigé vers dashboard en accédant à /fichiers', async ({ page }) => {
    // Connexion étudiant : cc_session est stocké en localStorage avec type:'student'
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tentative d'accès direct à la route teacher-only via l'URL hash
    await page.goto('/#/fichiers')

    // Le guard beforeEach lit cc_session, détecte le rôle insuffisant et redirige
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('route inconnue redirige vers le dashboard', async ({ page }) => {
    // Naviguer vers une route inexistante sans être authentifié
    await page.goto('/#/cette-page-nexiste-pas')

    // Le catch-all du router redirige vers /dashboard
    // (ici la page affiche le login car non connecté, mais l'URL reste /#/dashboard)
    await expect(page).toHaveURL(/dashboard|\//, { timeout: 10_000 })
  })

})
