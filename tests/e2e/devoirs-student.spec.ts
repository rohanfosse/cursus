import { test, expect } from '@playwright/test'
import { STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

/**
 * Devoirs - Parcours étudiant
 *
 * Vérifie que l'étudiant peut naviguer vers la section Devoirs,
 * que la vue StudentDevoirsView se monte correctement, et que les
 * alias de route fonctionnent.
 *
 * Prérequis : le compte étudiant de test est créé via provisionStudent()
 * (idempotent — pas d'effet si le compte existe déjà).
 */

test.describe('Devoirs - Étudiant', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('navigation vers /devoirs depuis le dashboard → vue devoirs visible', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 15_000 })
    // DevoirsView monte toujours .devoirs-area quelle que soit la liste des travaux
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
  })

  test('alias /travaux redirige transparentement vers /devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    // /travaux est un alias déclaré dans le router (redirect: '/devoirs')
    await page.goto('/#/travaux')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
  })

  test('retour au dashboard depuis les devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 15_000 })
    await navigateTo(page, 'dashboard')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
