import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

test.describe('Administration', () => {
  test('l\'admin accède au panneau d\'administration avec ses 5 onglets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    // Navigation directe — rfosse@cesi.fr a le rôle admin dans le seed
    await page.goto('/admin')
    await expect(page).toHaveURL(/admin/, { timeout: 10_000 })

    await expect(page.locator('.admin-view')).toBeVisible({ timeout: 10_000 })
    // Les 5 onglets définis dans AdminView : Santé, Erreurs, Statistiques, Utilisateurs, Modules
    await expect(page.locator('.adm-tab')).toHaveCount(5)
  })

  test('la navigation entre onglets admin fonctionne', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/admin')
    await expect(page.locator('.admin-view')).toBeVisible({ timeout: 10_000 })

    // Cliquer sur l'onglet "Utilisateurs" (texte exact du label dans AdminView)
    const usersTab = page.locator('.adm-tab', { hasText: 'Utilisateurs' })
    await expect(usersTab).toBeVisible({ timeout: 10_000 })
    await usersTab.click()

    // L'onglet devient actif et le panneau de contenu est visible
    await expect(usersTab).toHaveClass(/adm-tab--active/, { timeout: 5_000 })
    await expect(page.locator('.adm-body')).toBeVisible({ timeout: 10_000 })
  })
})
