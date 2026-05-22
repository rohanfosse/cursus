import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Flow couvert : navigation vers la section Messages.
 *
 * Parcours :
 *   1. Connexion en tant qu'enseignant
 *   2. Clic sur le bouton « Messages » du rail de navigation
 *   3. Vérification que l'URL change vers /messages
 *   4. Vérification que la zone principale des messages (#main-area) est rendue
 *
 * Ce test protège contre les régressions de chargement de MessagesView :
 * erreur d'import, crash de composable, ou route inaccessible.
 */
test.describe('Messages (navigation)', () => {
  test('naviguer vers Messages charge la zone de discussion', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Cliquer sur le bouton Messages du NavRail
    await navigateTo(page, 'messages')

    // L'URL doit refléter la section messages
    await expect(page).toHaveURL(/messages/, { timeout: 15_000 })

    // La zone principale de la vue Messages doit être montée
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 15_000 })
  })
})
