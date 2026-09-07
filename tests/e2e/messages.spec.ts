import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Messages', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant accède à la messagerie', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page.locator('#main-area, .main-area')).toBeVisible({ timeout: 15_000 })
  })

  test('étudiant accède à la messagerie', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')
    await expect(page.locator('#main-area, .main-area')).toBeVisible({ timeout: 15_000 })
  })
})
