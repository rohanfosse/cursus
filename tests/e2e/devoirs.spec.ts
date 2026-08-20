import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("un étudiant connecté peut naviguer vers la page devoirs", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/\/devoirs/)
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible()
  })
})
