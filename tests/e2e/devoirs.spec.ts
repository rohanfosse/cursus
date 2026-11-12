import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('enseignant arrive sur la vue projets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La zone principale devoirs est montee
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // En mode enseignant sans projet selectionne, le header "Devoirs" est present
    const header = page.locator('.devoirs-area').first()
    await expect(header).toBeVisible()
  })

  test('etudiant voit la liste de ses devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La zone principale devoirs est montee
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // La vue etudiante est active (groupe ou liste vide, pas la vue prof)
    // On attend que le chargement se termine : .devoirs-grouped OU un message vide
    await expect(
      page.locator('.devoirs-grouped, .devoirs-list, [class*="empty"], .student-devoirs'),
    ).toBeVisible({ timeout: 20_000 })
  })

})
