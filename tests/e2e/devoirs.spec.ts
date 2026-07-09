import { test, expect } from '@playwright/test'
import { STUDENT, TEACHER, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant accède à la liste de ses devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/)
    // StudentDevoirsView is mounted inside .devoirs-area (DevoirsView scoped style)
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })

  test("l'enseignant voit la vue projets dans les devoirs", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/)
    // TeacherProjectHome or TeacherProjectDetail is rendered inside .devoirs-area
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
  })
})
