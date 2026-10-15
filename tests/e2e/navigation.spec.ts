import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, SEL, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Navigation et garde de routes', () => {

  test('enseignant peut acceder a une route teacher-only (/booking)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/booking')
    // Un enseignant doit rester sur /booking (pas de redirect vers /dashboard)
    await expect(page).toHaveURL(/booking/, { timeout: 10_000 })
  })

  test('etudiant est redirige vers /dashboard sur une route teacher-only', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // Tentative d'acces a /fichiers (requiredRole: teacher)
    await page.goto('/#/fichiers')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('deconnexion ramene sur la page de login', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Ouvrir le menu utilisateur (avatar / profil)
    const avatarMenu = page.locator(
      '[data-testid="user-menu"], [data-testid="avatar"], .avatar-button, button[aria-label*="profil" i], button[aria-label*="compte" i]',
    ).first()
    await expect(avatarMenu).toBeVisible({ timeout: 10_000 })
    await avatarMenu.click()

    // Cliquer sur Deconnexion
    const logoutBtn = page.locator(
      'button:has-text("Déconnexion"), button:has-text("Deconnexion"), [data-testid="logout"]',
    ).first()
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()

    // Le formulaire de login doit reapparaitre
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
  })

})
