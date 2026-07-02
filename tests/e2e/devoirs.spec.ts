import { test, expect } from '@playwright/test'
import {
  TEACHER,
  STUDENT,
  provisionStudent,
  loginAndWaitDashboard,
  navigateTo,
} from './helpers'

test.describe('Devoirs', () => {
  test('enseignant accede a la vue devoirs et voit la zone de contenu', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant accede a la vue devoirs apres provisioning', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })
})
