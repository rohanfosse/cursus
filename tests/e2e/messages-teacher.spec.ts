import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

/**
 * Messages - Parcours enseignant
 *
 * Vérifie que l'enseignant peut accéder à la section Messages et
 * que la zone principale (#main-area) se monte correctement.
 * En contexte navigateur frais (localStorage vide), aucun salon
 * n'est mémorisé : soit un salon est auto-sélectionné via l'API,
 * soit l'état vide (hint desktop #no-channel-hint) s'affiche.
 */

test.describe('Messages - Enseignant', () => {

  test('navigation vers /messages charge la zone principale', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 15_000 })
    // #main-area est le conteneur racine de MessagesView, toujours présent
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })

  test('etat initial : header canal ou hint desktop est visible', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 15_000 })

    // En contexte frais (pas de salon sauvegardé), deux cas possibles :
    //   1. Un salon est chargé automatiquement → #channel-header visible
    //   2. Aucun salon sélectionné → #no-channel-hint visible
    // Les deux sont des états valides ; on vérifie qu'au moins l'un s'affiche.
    const channelHeaderVisible = await page
      .locator('#channel-header')
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    if (!channelHeaderVisible) {
      await expect(page.locator('#no-channel-hint')).toBeVisible({ timeout: 8_000 })
    }
  })

  test('retour au dashboard depuis les messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 15_000 })
    await navigateTo(page, 'dashboard')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
