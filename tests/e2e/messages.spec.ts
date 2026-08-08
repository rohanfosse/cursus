import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Messages', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant accede a la section messages et voit la zone de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // La zone principale (id=main-area, toujours presente dans MessagesView) doit etre visible
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant accede a la section messages et voit la zone de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })
})
