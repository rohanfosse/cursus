import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test("un enseignant accède à la vue devoirs et voit le contenu", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/\/devoirs/)
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.devoirs-content')).toBeVisible()
  })

  test("un étudiant accède à ses devoirs", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/\/devoirs/)
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test("le garde de route exam-review bloque un étudiant et le redirige", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /exam-review/:id a requiredRole: 'teacher' — un étudiant doit être renvoyé au dashboard
    await page.goto('/#/exam-review/1')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 })
  })
})
