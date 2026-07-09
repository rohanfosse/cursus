import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Authentification – déconnexion', () => {
  test('un enseignant peut se déconnecter via les paramètres', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Open settings modal via the NavRail avatar button
    await page.locator('#nav-user-avatar').click()

    // Click the logout button in the settings sidebar
    const logoutBtn = page.locator('button.stg-nav-item.stg-nav-danger')
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()

    // Confirm in the dialog that appears (text matches the 3rd arg of confirmAction)
    const confirmBtn = page.getByRole('button', { name: /se d[eé]connecter/i }).last()
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // After logout the login form must be visible
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
  })
})
