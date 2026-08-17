import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs – vue étudiant', () => {
  test.beforeAll(async () => {
    // Crée le compte étudiant de test si absent (idempotent via 409)
    await provisionStudent()
  })

  test('étudiant : navigue vers /devoirs et voit sa liste de travaux', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La zone devoirs est montée (racine de DevoirsView)
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // L'en-tête affiche le titre "Devoirs" (DevoirsHeader → .dh-title-text)
    await expect(page.locator('.devoirs-area')).toContainText('Devoirs')

    // Aucune erreur serveur ne doit s'afficher
    await expect(page.locator('text=/erreur serveur|500/i')).not.toBeVisible()
  })
})
