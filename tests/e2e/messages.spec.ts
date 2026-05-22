import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, provisionStudent, STUDENT } from './helpers'

test.describe('Messages', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un etudiant peut acceder a la messagerie et voir la liste des canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/)
    // La sidebar/liste de canaux est rendue
    const channelList = page.locator(
      '[class*="channel"], [class*="sidebar"], aside, [data-testid*="channel"]'
    ).first()
    await expect(channelList).toBeVisible({ timeout: 10_000 })
  })
})
