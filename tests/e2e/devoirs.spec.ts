import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Vue Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant voit la vue Devoirs avec le bouton "Nouveau devoir"', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    // Le bouton "Nouveau devoir" est exclusif a la vue enseignant
    await expect(page.locator('button:has-text("Nouveau devoir")')).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant voit la vue Devoirs sans le bouton "Nouveau devoir"', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    // L'etudiant ne peut pas creer de devoir
    await expect(page.locator('button:has-text("Nouveau devoir")')).not.toBeVisible()
  })

})
