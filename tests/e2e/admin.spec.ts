import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Admin — controle d\'acces', () => {

  test('enseignant : /admin est protege et redirige vers /dashboard', async ({ page }) => {
    // Connexion en tant qu'enseignant (type='teacher', ROLE_LEVEL=2)
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Navigation directe vers /admin — provoque un rechargement de page.
    // Le router guard lit cc_session depuis localStorage (synchrone) et
    // compare : teacher (2) < admin (3) → next('/dashboard').
    await page.goto('/#/admin')

    // L'URL doit basculer sur /dashboard, jamais sur /admin
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // La vue admin ne doit pas etre montee dans le DOM
    await expect(page.locator('.admin-view')).not.toBeAttached()
  })

})
