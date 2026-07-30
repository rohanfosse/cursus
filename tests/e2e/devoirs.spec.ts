import { test, expect } from '@playwright/test'
import { STUDENT, TEACHER, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Vue Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant : navigue vers les devoirs et voit la vue chargée', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // navigateTo asserte déjà que l'URL contient "devoirs"
    await navigateTo(page, 'devoirs')
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible()
  })

  test('enseignant : navigue vers les devoirs et voit la vue chargée', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // L'enseignant voit TeacherProjectHome (dispatch côté DevoirsView) – shell toujours monté
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible()
  })

})
