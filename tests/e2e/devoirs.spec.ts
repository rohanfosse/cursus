import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('etudiant voit la section devoirs avec sa vue personnelle', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    // Le conteneur principal doit etre monte : devoirs-area > devoirs-content
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })
    // L'URL doit rester sur /devoirs (pas de redirection inattendue)
    await expect(page).toHaveURL(/devoirs/)
  })

  test('enseignant voit la vue gestion des devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })
    // L'enseignant ne voit pas la vue etudiante (StudentDevoirsView n'est pas rendue)
    await expect(page.locator('.devoirs-list').first()).not.toBeVisible({ timeout: 5_000 })
  })
})
