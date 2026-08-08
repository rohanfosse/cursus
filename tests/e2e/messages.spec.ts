import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, TEACHER } from './helpers'

test.describe('Vue messages', () => {
  test("la vue messages se charge correctement pour un enseignant", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
  })

  test("la zone principale affiche l'en-tête de canal ou le hint de sélection", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/messages')
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 10_000 })
    // Un canal peut être auto-sélectionné (#channel-header) ou pas (#no-channel-hint)
    await expect(page.locator('#channel-header, #no-channel-hint')).toBeVisible({ timeout: 10_000 })
  })
})
