import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, SEL, login, provisionStudent } from './helpers'

test.describe('Authentification', () => {

  test('affiche la page de login', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator(SEL.emailInput)).toBeVisible()
    await expect(page.locator(SEL.passwordInput)).toBeVisible()
  })

  test('refuse un login invalide', async ({ page }) => {
    await login(page, 'invalide@test.com', 'wrongpassword')
    await expect(page.locator('text=/erreur|invalide|incorrect/i')).toBeVisible({ timeout: 10_000 })
  })

  test('connecte un enseignant et affiche le dashboard', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('connecte un etudiant et affiche le dashboard', async ({ page }) => {
    await provisionStudent()
    await login(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
