import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, provisionStudent, STUDENT } from './helpers'

test.describe('Devoirs – parcours étudiant', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant connecté accède à la page devoirs', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
  })

  test('la page devoirs se charge et affiche un état final cohérent', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Attendre la fin du chargement : les squelettes disparaissent
    await page.waitForFunction(
      () => !document.querySelector('.skel-card'),
      { timeout: 20_000 },
    )

    // État post-chargement : liste vide ou contenu réel
    const emptyState = page.locator('.es-title', { hasText: 'Aucun devoir assigné' })
    const devoirsContent = page.locator('.dv-page, .student-devoir-group, .sdv-search')
    await expect(emptyState.or(devoirsContent)).toBeVisible({ timeout: 5_000 })
  })
})
