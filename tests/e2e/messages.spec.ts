import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Vue Messages', () => {

  test('enseignant : accède à la vue messages et voit l\'interface de chat', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // navigateTo asserte que l'URL contient "messages" avant de retourner
    await navigateTo(page, 'messages')
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible()
  })

})
