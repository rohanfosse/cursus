import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Section Messages', () => {
  test('enseignant navigue vers les messages et voit la vue', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    // La vue messages se monte : sidebar ou liste de canaux visible
    await expect(page.locator('aside, .messages-view, [role="navigation"]').first()).toBeVisible({ timeout: 12_000 })
  })

  test('la dernière route est persistée dans localStorage après navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Le afterEach du router stocke { path: '/messages' } sous la clé cc_last_route
    const stored = await page.evaluate(() => localStorage.getItem('cc_last_route'))
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored as string) as { path: string }
    expect(parsed.path).toBe('/messages')
  })

  test('la route est mise à jour après une deuxième navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await navigateTo(page, 'documents')
    // Après navigation vers documents, cc_last_route doit pointer sur /documents
    const stored = await page.evaluate(() => localStorage.getItem('cc_last_route'))
    const parsed = JSON.parse(stored as string) as { path: string }
    expect(parsed.path).toBe('/documents')
  })
})
