import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant navigue vers messages et voit la zone principale', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La zone principale de messages doit etre presente
    await expect(page.locator('#main-area, .main-area')).toBeVisible({ timeout: 15_000 })
  })

  test('la zone messages affiche un canal ou un etat vide apres chargement', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Soit un header de canal est visible (canal actif), soit un etat vide est affiche
    const hasChannelHeader = await page.locator('#channel-header, .channel-header').isVisible({ timeout: 15_000 }).catch(() => false)
    const hasEmptyState = await page.locator('.empty-state, [class*="empty"]').isVisible({ timeout: 5_000 }).catch(() => false)

    expect(hasChannelHeader || hasEmptyState, 'La vue messages doit afficher un canal actif ou un etat vide').toBe(true)
  })

})
