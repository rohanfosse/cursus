/**
 * Tests E2E – Messages
 *
 * Flows couverts :
 *   1. Navigation vers /messages → zone principale (#main-area) chargée et URL correcte
 *   2. Sidebar : au moins un canal visible après connexion enseignant
 *
 * Prérequis : compte enseignant TEACHER (rfosse@cesi.fr) + base seedée avec canaux.
 */
import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {
  test('la page messages est accessible depuis la NavRail', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La zone principale des messages est montée dans le DOM
    await expect(page.locator('#main-area')).toBeAttached({ timeout: 15_000 })
    await expect(page).toHaveURL(/messages/)
  })

  test('la sidebar liste au moins un canal après connexion', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // ChannelItem rend : <button class="sidebar-item"><span class="channel-name">…</span></button>
    // La base de test est seedée avec au moins un canal "general" par promo
    const firstChannel = page.locator('.sidebar-item .channel-name').first()
    await expect(firstChannel).toBeVisible({ timeout: 15_000 })
  })
})
