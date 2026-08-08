import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, SEL, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Navigation et gardes de routes', () => {

  test("déconnexion : retour à l'écran de connexion", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Chercher le bouton de déconnexion via le menu avatar ou directement
    const avatarTrigger = page.locator(
      '[data-testid="user-menu"], [data-testid="avatar"], .avatar-button, button[aria-label*="profil" i]'
    ).first()

    const avatarVisible = await avatarTrigger.isVisible({ timeout: 3_000 }).catch(() => false)
    if (avatarVisible) {
      await avatarTrigger.click()
      await page.waitForTimeout(500)
    }

    const logoutBtn = page.locator(
      'button:has-text("Déconnexion"), button:has-text("Deconnexion"), [data-testid="logout"], button[aria-label*="déconnexion" i]'
    ).first()
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()

    // Après déconnexion, le formulaire de login est à nouveau visible
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
    // Et l'URL ne contient plus /dashboard
    await expect(page).not.toHaveURL(/dashboard/)
  })

  test('garde de rôle : /admin redirige un étudiant vers le dashboard', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)

    // Tenter d'accéder à la page admin (requiert rôle 'admin')
    await page.goto('/#/admin')
    // Le guard beforeEach redirige vers /dashboard pour les non-admins
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // La page admin ne doit pas être rendue
    await expect(page.locator('button:has-text("Santé"), button:has-text("Erreurs")')).not.toBeVisible()
  })

})
