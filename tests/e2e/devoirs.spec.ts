import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant : accède à la vue devoirs avec le bouton "Nouveau devoir"', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('button.dh-new, button:has-text("Nouveau devoir")')).toBeVisible({ timeout: 10_000 })
  })

  test('étudiant : accède à la vue devoirs sans le bouton "Nouveau devoir"', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('button.dh-new')).not.toBeVisible()
  })
})
