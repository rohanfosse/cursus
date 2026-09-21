import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard } from './helpers'

test.describe('Etudiant - authentification et contrôle d\'accès', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('connecte un étudiant et affiche le dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/)
  })

  test('bloque l\'accès étudiant à une route teacher-only et redirige', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })

  test('bloque l\'accès étudiant à une route admin-only et redirige', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })
})
