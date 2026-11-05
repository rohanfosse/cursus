import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Navigation et gardes de routes', () => {

  test('enseignant : la vue /messages se charge avec la zone principale', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // Navigation directe vers messages
    await page.goto('/#/messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // #main-area est le div racine de MessagesView, toujours present (canal actif ou hint vide)
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant : tentative acces a /booking (enseignant uniquement) => redirection dashboard', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /booking a meta { requiredRole: 'teacher' } : le guard doit rediriger vers /dashboard
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant : tentative acces a /admin (admin uniquement) => redirection dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // /admin a meta { requiredRole: 'admin' } : un teacher (level 2) ne passe pas
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
