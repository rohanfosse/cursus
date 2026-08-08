import { test, expect } from '@playwright/test'
import { provisionStudent, loginAndWaitDashboard, navigateTo, TEACHER, STUDENT } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant accède à la liste de devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant accède à la vue devoirs enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test('exam-review redirige un étudiant vers le dashboard (garde de rôle)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // La route /exam-review/:id requiert requiredRole: 'teacher'
    await page.goto('/#/exam-review/1')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // Vérification : la vue devoirs n'est pas affichée
    await expect(page.locator('.devoirs-area')).not.toBeVisible()
  })
})
