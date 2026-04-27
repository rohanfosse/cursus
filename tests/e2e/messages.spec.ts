import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

test.describe('Messages', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un enseignant accède à la section messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/messages')

    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // Soit un canal est sélectionné (#channel-header), soit l'écran d'accueil est affiché (#no-channel-hint)
    await expect(
      page.locator('#channel-header').or(page.locator('#no-channel-hint')),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('la barre de recherche est présente quand un canal est actif', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/messages')

    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    const channelHeader = page.locator('#channel-header')
    if (await channelHeader.isVisible({ timeout: 8_000 }).catch(() => false)) {
      // Un canal est sélectionné : la barre de recherche et le bouton membres doivent être accessibles
      await expect(page.locator('#search-input')).toBeVisible()
      await expect(page.locator('button[aria-label="Afficher les membres"]')).toBeVisible()
    } else {
      // Aucun canal sélectionné : l'accueil messages est attendu
      await expect(page.locator('#no-channel-hint')).toBeVisible()
    }
  })

  test('un étudiant accède à la section messages', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/messages')

    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    await expect(
      page.locator('#channel-header').or(page.locator('#no-channel-hint')),
    ).toBeVisible({ timeout: 15_000 })
  })
})
