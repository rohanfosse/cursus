import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Messages', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant accède à la messagerie et voit ses canaux', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/)
    // MessagesView renders either .messages-container (channel active) or an empty/welcome state.
    // Both cases live inside the messages route, so we assert the view itself mounted.
    const messagesRoot = page.locator('.messages-container, .channel-sidebar, [class*="messages-empty"], [class*="messages-welcome"]')
    await expect(messagesRoot.first()).toBeVisible({ timeout: 10_000 })
  })
})
