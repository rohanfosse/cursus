import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant peut accéder à la vue devoirs et la voir chargée', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // La zone principale de la vue Devoirs doit être montée
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
  })

  test('la vue devoirs contient le header de section', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
    // DevoirsHeader rend UiPageHeader avec section="devoirs" : un élément portant
    // le texte "Devoirs" doit être visible dans la page (breadcrumb ou titre).
    await expect(
      page.locator('.devoirs-area [class*="page-header"], .devoirs-area header, .devoirs-area [class*="dh-title"]'),
    ).toBeVisible({ timeout: 15_000 })
  })

})
