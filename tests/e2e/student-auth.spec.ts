import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, login, loginAndWaitDashboard } from './helpers'

test.describe('Authentification – flux étudiant', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('connecte un étudiant et le redirige vers le dashboard', async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // Vérifier via localStorage que la session est bien réelle (non-demo)
    await expect.poll(async () => {
      return await page.evaluate(() => {
        try {
          const raw = localStorage.getItem('cc_session')
          if (!raw) return false
          const s = JSON.parse(raw)
          return !!s && s.demo !== true
        } catch { return false }
      })
    }, { timeout: 10_000 }).toBe(true)
  })

  test('redirige un étudiant depuis une route réservée aux enseignants', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /booking requiert le rôle 'teacher' – le garde beforeEach doit renvoyer vers /dashboard
    await page.goto('/#/booking')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })

})
