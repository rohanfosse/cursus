import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, provisionStudent, STUDENT } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un etudiant peut acceder a la page des devoirs et voir son contenu', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/)
    // La vue est montee et contient un element principal visible
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 })
  })
})
