import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant voit la vue de gestion de projets dans Devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    // Le contenu devoirs est monté (TeacherProjectHome ou TeacherProjectDetail)
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })
  })

  test('étudiant voit ses devoirs avec la terminologie attendue', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    // StudentDevoirsView affiche toujours au moins un de ces termes dans les stats ou filtres
    const keyword = page.locator('text=/examen|livrable|soutenance|devoir|rendu/i').first()
    await expect(keyword).toBeVisible({ timeout: 10_000 })
  })
})
