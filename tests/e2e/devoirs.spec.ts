import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {
  test('un étudiant peut accéder à la vue devoirs et voir son espace de travaux', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    await expect(page).toHaveURL(/\/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 8_000 })
  })

  test('un enseignant peut accéder à la vue devoirs et gérer ses projets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    await expect(page).toHaveURL(/\/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 8_000 })
  })
})
