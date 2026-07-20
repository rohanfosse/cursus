import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Gardes de route – rôles', () => {

  test.beforeAll(async () => {
    // S'assure que le compte étudiant existe avant les tests du groupe
    await provisionStudent()
  })

  test('un étudiant tentant d\'accéder à /admin est redirigé vers /dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Confirmation : l'étudiant démarre bien sur le dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Navigation côté client vers /admin (sans rechargement de page, afin que
    // le guard Vue Router soit le seul mécanisme en jeu — pas onMounted App.vue)
    await page.evaluate(() => { window.location.hash = '/admin' })

    // Le guard beforeEach (hasRole 'student' vs 'admin') doit renvoyer vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 })

    // Le bouton Admin (class .nav-admin-btn) n'est visible que pour les admins
    await expect(page.locator('.nav-admin-btn')).not.toBeVisible()
  })

})
