import { test, expect } from '@playwright/test'
import { STUDENT, TEACHER, loginAndWaitDashboard, provisionStudent, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('étudiant voit la page devoirs après connexion', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    // La zone principale des devoirs doit être montée
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test('étudiant redirigé vers le dashboard sur une route réservée aux enseignants', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /booking requiert requiredRole: 'teacher' → doit rediriger
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
