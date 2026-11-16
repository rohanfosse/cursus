import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('etudiant connecte voit la page devoirs (vue etudiant)', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La page est bien chargee
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // Vue etudiant : pas de boutons de creation/publication reserves au prof
    await expect(
      page.locator('button:has-text("Publier"), button:has-text("Nouveau devoir"), button:has-text("Ajouter un devoir")')
    ).not.toBeVisible({ timeout: 3_000 })
  })

  test('enseignant connecte voit la page devoirs (vue enseignant)', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // La page doit se charger sans erreur visible
    await expect(page.locator('text=/erreur|error|500/i')).not.toBeVisible({ timeout: 5_000 })

    // Vue enseignant : le role est correctement detecte (session storage)
    const role = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('cc_session')
        if (!raw) return null
        return JSON.parse(raw).type
      } catch { return null }
    })
    expect(role).toBe('teacher')
  })

})
