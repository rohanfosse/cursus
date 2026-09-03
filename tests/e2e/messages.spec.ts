import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, TEACHER } from './helpers'

test.describe('Messages', () => {

  test('enseignant - section messages charge la liste des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // La sidebar des canaux doit etre visible
    const channelSidebar = page.locator([
      '[data-testid="channel-list"]',
      '[data-testid="channel-sidebar"]',
      '.channel-list',
      '.channels-sidebar',
      'aside',
    ].join(', ')).first()
    await expect(channelSidebar).toBeVisible({ timeout: 15_000 })

    // Au moins un canal "general" doit apparaitre (present dans toutes les promos)
    const generalChannel = page.locator([
      '[data-testid="channel-item"]:has-text("general")',
      '.channel-name:has-text("general")',
      'li:has-text("general")',
      'button:has-text("general"), a:has-text("general")',
    ].join(', ')).first()
    await expect(generalChannel).toBeVisible({ timeout: 15_000 })
  })

  test('enseignant - cliquer sur un canal ouvre la zone de messages', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    // Attendre et cliquer sur le premier canal disponible
    const firstChannel = page.locator([
      '[data-testid="channel-item"]',
      '.channel-name',
      'aside li button, aside li a',
    ].join(', ')).first()
    await expect(firstChannel).toBeVisible({ timeout: 15_000 })
    await firstChannel.click()

    // La zone d'input de message doit apparaitre apres selection d'un canal
    const messageInput = page.locator([
      '[data-testid="message-input"]',
      'textarea[placeholder*="message" i]',
      'input[placeholder*="message" i]',
      '.message-input',
      '[contenteditable="true"]',
    ].join(', ')).first()
    await expect(messageInput).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant demo - section messages accessible et canaux visibles', async ({ page }) => {
    // Demarrer une session demo etudiant
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    const [startRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.click('button:has-text("Etudiant")'),
    ])
    expect(startRes.ok()).toBe(true)
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })

    await navigateTo(page, 'messages')

    // La section messages doit se charger (au moins la sidebar ou la zone principale)
    const messagesUI = page.locator([
      '[data-testid="channel-list"]',
      '[data-testid="messages-view"]',
      '.messages-view',
      'aside',
      '.channel-list',
    ].join(', ')).first()
    await expect(messagesUI).toBeVisible({ timeout: 15_000 })

    // Aucune erreur critique
    const criticalError = page.locator('text=/500|erreur critique|uncaught/i')
    await expect(criticalError).not.toBeVisible()
  })

})
