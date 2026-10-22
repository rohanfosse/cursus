import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant voit la section devoirs avec le bouton "Nouveau devoir"', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // Le conteneur principal de la vue doit être present
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // Le titre "Devoirs" doit apparaître dans le header
    await expect(page.locator('.dh-title-text')).toHaveText('Devoirs', { timeout: 5_000 })

    // Le prof a le bouton d'ajout de devoir
    await expect(page.locator('button:has-text("Nouveau devoir")')).toBeVisible({ timeout: 5_000 })
  })

  test('étudiant voit sa liste de devoirs après connexion', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La section devoirs se charge
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // Le titre doit être présent
    await expect(page.locator('.dh-title-text')).toHaveText('Devoirs', { timeout: 5_000 })

    // Le bouton "Nouveau devoir" ne doit PAS être visible pour un étudiant
    await expect(page.locator('button:has-text("Nouveau devoir")')).not.toBeVisible()

    // Vérifier que la session en localStorage est bien de type 'student'
    const role = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('cc_session')
        if (!raw) return null
        return JSON.parse(raw).type
      } catch { return null }
    })
    expect(role).toBe('student')
  })

})
