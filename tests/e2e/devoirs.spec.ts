import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant accede aux devoirs et voit la vue projet', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La vue enseignant doit charger : titre de section visible
    await expect(page.locator('text=/devoirs|travaux|projet/i').first()).toBeVisible({ timeout: 15_000 })

    // Il doit y avoir un conteneur de liste de devoirs (pas un ecran vide)
    const contentZone = page.locator('.devoirs-area, .devoirs-content, [class*="devoirs"]').first()
    await expect(contentZone).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant accede aux devoirs et voit ses rendus ou une liste vide', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La section devoirs doit etre chargee (pas de blank screen)
    await expect(page.locator('.devoirs-area, .devoirs-content, [class*="devoirs"]').first()).toBeVisible({ timeout: 15_000 })

    // L'interface etudiant ne doit pas montrer les boutons de gestion enseignant
    await expect(page.locator('button:has-text("Nouveau devoir"), button:has-text("Publier tout")')).not.toBeVisible({ timeout: 3_000 })
  })

})
