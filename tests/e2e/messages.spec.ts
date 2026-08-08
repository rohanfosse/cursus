import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Couverture : navigation vers la section messages et rendu de la vue.
 *
 * Le flow messages existant n'est testé qu'en tant que sous-étape dans
 * cross-promo-isolation.spec.ts (marqué .skip). Ce fichier fournit une
 * couverture standalone qui tourne en CI.
 */
test.describe('Messages - navigation', () => {
  test('un enseignant peut accéder à la section messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // La vue messages est bien montée (zone principale visible)
    await expect(page.locator('.main-area')).toBeVisible({ timeout: 15_000 })
  })

  test('la vue messages affiche un en-tête de canal après sélection automatique', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Un canal est sélectionné par défaut → l'en-tête de canal est rendu.
    // On vérifie seulement la présence du header, pas son contenu exact
    // (dépend du seed).
    await expect(page.locator('#channel-header, .channel-header')).toBeVisible({ timeout: 15_000 })
  })
})
