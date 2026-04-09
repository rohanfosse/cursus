import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Tests E2E : Vue Messages
 *
 * Parcours couvert :
 *   - Enseignant : navigation vers Messages, sélection du premier canal disponible
 *     dans la barre latérale, affichage de la zone de saisie de message.
 *
 * Pré-requis : au moins un canal existe dans la base (création via seed ou migration).
 */

test.describe('Messages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
  })

  test("enseignant sélectionne un canal et voit la zone de saisie", async ({ page }) => {
    // La liste de canaux doit apparaître dans la barre latérale
    const firstChannel = page.locator('.sidebar-item').first()
    await expect(firstChannel).toBeVisible({ timeout: 15_000 })

    // Cliquer sur le premier canal pour l'activer
    await firstChannel.click()

    // Après sélection, le conteneur de messages et la textarea de saisie
    // sont rendus conditionnellement par MessagesView
    await expect(
      page.locator('#messages-container textarea'),
    ).toBeVisible({ timeout: 10_000 })
  })
})
