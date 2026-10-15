import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant accede aux messages et voit la liste des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La sidebar des canaux doit etre presente
    const sidebar = page.locator('aside, .sidebar, .channels-list, [class*="channel"]').first()
    await expect(sidebar).toBeVisible({ timeout: 15_000 })

    // Au moins un element de type canal ou conversation doit etre liste
    const channelItems = page.locator(
      '[data-testid="channel-item"], .channel-item, [class*="channel-name"], aside li, .channel-list li',
    )
    await expect(channelItems.first()).toBeVisible({ timeout: 10_000 })
  })

  test('la zone de saisie de message est accessible apres selection d\'un canal', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Cliquer sur le premier canal disponible
    const firstChannel = page.locator(
      '[data-testid="channel-item"], .channel-item, aside li a, aside li button',
    ).first()
    await expect(firstChannel).toBeVisible({ timeout: 15_000 })
    await firstChannel.click()

    // Apres selection du canal, la zone de saisie doit apparaitre
    const messageInput = page.locator(
      'textarea[placeholder], [contenteditable="true"], [data-testid="message-input"], .message-input',
    ).first()
    await expect(messageInput).toBeVisible({ timeout: 10_000 })
  })

})
