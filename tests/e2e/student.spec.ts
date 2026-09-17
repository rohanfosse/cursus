import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Étudiant — auth et navigation', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('connecte un étudiant et affiche le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible()
  })

  test('étudiant peut naviguer vers la vue devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
  })
})
