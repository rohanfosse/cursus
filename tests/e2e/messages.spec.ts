import { test, expect } from '@playwright/test'
import { provisionStudent, loginAndWaitDashboard, navigateTo, TEACHER, STUDENT } from './helpers'

test.describe('Messages', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('la vue messages charge la structure principale', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // La zone centrale (#main-area) doit être montée
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })

  test('un canal actif ou le hint vide est affiché après navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // Selon que l'étudiant a des canaux : header canal OU hint "aucun canal sélectionné"
    const channelHeader = page.locator('#channel-header')
    const noChannelHint = page.locator('#no-channel-hint')
    await expect(channelHeader.or(noChannelHint)).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant : bouton recherche présent dans le header du canal', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // Si un canal est actif, le bouton de recherche (#btn-search) doit être présent
    const channelHeader = page.locator('#channel-header')
    const hasChannel = await channelHeader.isVisible({ timeout: 5_000 }).catch(() => false)
    if (hasChannel) {
      await expect(page.locator('#btn-search')).toBeVisible({ timeout: 5_000 })
    }
  })
})
