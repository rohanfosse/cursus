import { test, expect, type Page } from '@playwright/test'
import { TEACHER, STUDENT, SEL, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Helper : deconnecter l'utilisateur courant.
 * Reproduit la logique de cross-promo-isolation.spec.ts (qui est en test.skip).
 */
async function logout(page: Page): Promise<void> {
  const avatarMenu = page
    .locator('[data-testid="user-menu"], [data-testid="avatar"], .avatar-button, button[aria-label*="profil" i]')
    .first()
  if (await avatarMenu.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await avatarMenu.click()
  }
  await page
    .locator('button:has-text("Déconnexion"), button:has-text("Deconnexion"), [data-testid="logout"], button[aria-label*="déconnexion" i]')
    .first()
    .click({ timeout: 5_000 })
  await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
}

test.describe('Gestion de session', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant se deconnecte et retrouve le formulaire de login', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await logout(page)
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 5_000 })
    await expect(page.locator(SEL.passwordInput)).toBeVisible()
  })

  test('enseignant peut se reconnecter apres deconnexion', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await logout(page)
    // Re-login doit fonctionner normalement
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('etudiant se deconnecte et retrouve le formulaire de login', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await logout(page)
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 5_000 })
  })
})
