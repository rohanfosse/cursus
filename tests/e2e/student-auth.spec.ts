import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Authentification étudiant', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant se connecte, voit le dashboard et accède aux devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible()

    // L'étudiant peut naviguer vers les devoirs
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })
})
