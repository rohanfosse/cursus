import { test, expect } from '@playwright/test'
import { STUDENT, TEACHER, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Vue Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("Un enseignant accède à la vue devoirs", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/)
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test("Un étudiant accède à la vue devoirs", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/)
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })
})
