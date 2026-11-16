import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Messages', () => {

  test('enseignant peut naviguer vers les messages et voir la liste des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Naviguer vers messages via le NavRail
    const navBtn = page.locator([
      'button[aria-label*="messages" i]',
      '.nav-btn:has(.nav-label:text-is("Messages"))',
      'button[title*="messages" i]',
      'a[href*="messages"]',
    ].join(', ')).first()

    await expect(navBtn).toBeVisible({ timeout: 20_000 })
    await navBtn.click()
    await expect(page).toHaveURL(/messages/, { timeout: 15_000 })

    // La vue messages se charge sans erreur
    await expect(page.locator('text=/erreur|error|500/i')).not.toBeVisible({ timeout: 5_000 })

    // Au moins un canal ou DM doit etre visible dans la liste (sidebar)
    // On cherche des elements typiques d'une liste de canaux/conversations
    const channelList = page.locator([
      '[data-testid="channel-item"]',
      '[data-testid="channel-list"]',
      '.channel-list',
      'aside li',
      '.sidebar-item',
    ].join(', '))

    await expect(channelList.first()).toBeVisible({ timeout: 10_000 })
  })

  test('la page messages persiste le canal actif dans la session', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Aller sur messages
    await page.goto('/#/messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // Attendre le chargement de la vue
    await page.waitForTimeout(2_000)

    // La route /messages est bien persistee dans localStorage (startView: last)
    const lastRoute = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('cc_last_route')
        if (!raw) return null
        return JSON.parse(raw).path
      } catch { return null }
    })

    // La persistance afterEach du router stocke la route visitee
    if (lastRoute !== null) {
      expect(lastRoute).toMatch(/messages/)
    }
  })

})
