import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Section Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant navigue vers les devoirs et voit la vue teacher', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    // La vue teacher devoirs se monte : au moins un titre ou container est visible
    await expect(page.locator('h1, h2, h3, .devoirs-header').first()).toBeVisible({ timeout: 12_000 })
  })

  test('étudiant navigue vers les devoirs et voit sa vue', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    // La vue étudiant se monte sans crash (main ou section est visible)
    await expect(page.locator('main, section, .devoirs-view').first()).toBeVisible({ timeout: 12_000 })
  })

  test('enseignant accède à /exam-review (route protégée teacher)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // /exam-review/:travailId est réservé au prof — l'accès ne doit PAS rediriger vers /dashboard
    await page.goto('/#/exam-review/9999')
    await expect(page).toHaveURL(/exam-review/, { timeout: 8_000 })
  })
})
