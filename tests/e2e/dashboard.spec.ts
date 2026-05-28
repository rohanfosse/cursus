import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, TEACHER } from './helpers'

test.describe('Dashboard', () => {
  test('le dashboard enseignant monte le shell et affiche la barre de navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await expect(page).toHaveURL(/dashboard/)
    // Le shell applicatif est monté
    await expect(page.locator('#app-shell, .app-shell, .app-columns').first()).toBeVisible()
    // La NavRail contenant les liens de navigation est présente
    const navRail = page.locator('nav, [class*="nav-rail"], [class*="nav_rail"]').first()
    await expect(navRail).toBeVisible({ timeout: 10_000 })
  })

  test('navigation inter-sections depuis le dashboard : devoirs → messages → dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await expect(page).toHaveURL(/dashboard/)

    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/\/devoirs/)

    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/\/messages/)

    await navigateTo(page, 'dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
