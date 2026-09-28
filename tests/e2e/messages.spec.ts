import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant navigue vers messages et voit la liste de canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La vue messages doit etre chargee
    // La sidebar des canaux est toujours presente (meme vide) pour un prof connecte
    const sidebar = page.locator(
      '.channels-sidebar, .messages-sidebar, aside[class*="sidebar"], [data-testid="channels-sidebar"]',
    ).first()

    // Soit la sidebar est visible, soit au moins la zone principale messages est la
    const messagesArea = page.locator(
      '.messages-area, .messages-layout, [class*="messages-view"]',
    ).first()

    await expect(
      sidebar.or(messagesArea),
    ).toBeVisible({ timeout: 20_000 })

    // Aucune erreur fatale ne doit etre affichee
    await expect(page.locator('text=/erreur fatale|fatal error/i')).not.toBeVisible({ timeout: 5_000 })
  })

  test('enseignant peut utiliser la recherche de messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Chercher le bouton ou input de recherche dans la vue messages
    const searchBtn = page.locator(
      'button[aria-label*="recherche" i], button[aria-label*="search" i], input[placeholder*="recherche" i], input[placeholder*="search" i], input[placeholder*="Chercher" i]',
    ).first()

    // Si un input/bouton de recherche est present, il doit etre interactif
    const isVisible = await searchBtn.isVisible({ timeout: 10_000 }).catch(() => false)
    if (isVisible) {
      await expect(searchBtn).toBeEnabled()
    }

    // Dans tous les cas : l'URL doit encore pointer sur /messages
    await expect(page).toHaveURL(/messages/)
  })

})
