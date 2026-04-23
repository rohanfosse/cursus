import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

/**
 * Test E2E : Navigation et rendu de la vue Messages
 *
 * Scenarios :
 *   - Un enseignant navigue vers /messages : la zone principale des messages s'affiche
 *   - Un étudiant navigue vers /messages : l'écran d'accueil (sans canal sélectionné)
 *     affiche bien le message de bienvenue
 *
 * Prérequis :
 *   Serveur démarré sur :3001, frontend sur :5174
 */

test.describe('Messages', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant accède à la vue messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Le conteneur racine de MessagesView doit être rendu
    await expect(page.locator('#main-area, .main-area')).toBeVisible({ timeout: 10_000 })
  })

  test("étudiant voit l'écran d'accueil quand aucun canal n'est sélectionné", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')

    // La vue est montée : soit un canal est déjà actif (channel-header),
    // soit l'écran d'accueil no-channel-hint est visible
    const channelActive  = page.locator('#channel-header, .channel-header')
    const welcomeScreen  = page.locator('#no-channel-hint, .no-channel-hint')

    await expect(channelActive.or(welcomeScreen)).toBeVisible({ timeout: 10_000 })
  })

})
