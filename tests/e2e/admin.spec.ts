import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard } from './helpers'

// rfosse@cesi.fr a le rôle 'admin' dans le seed (schema.js) : accès autorisé.
test.describe('Admin', () => {

  test('un administrateur accède au panneau admin et voit les 5 onglets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Navigation directe vers /#/admin (hash routing Vue Router)
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/admin/, { timeout: 10_000 })
    await expect(page.locator('.admin-view')).toBeVisible({ timeout: 15_000 })

    // Les 5 onglets de la sidebar admin doivent tous être présents
    await expect(page.locator('.adm-tab', { hasText: 'Santé' })).toBeVisible()
    await expect(page.locator('.adm-tab', { hasText: 'Erreurs' })).toBeVisible()
    await expect(page.locator('.adm-tab', { hasText: 'Statistiques' })).toBeVisible()
    await expect(page.locator('.adm-tab', { hasText: 'Utilisateurs' })).toBeVisible()
    await expect(page.locator('.adm-tab', { hasText: 'Modules' })).toBeVisible()
  })

  test('un administrateur peut naviguer entre les onglets admin', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/admin')
    await expect(page.locator('.admin-view')).toBeVisible({ timeout: 15_000 })

    // Cliquer sur "Utilisateurs" et vérifier qu'il devient l'onglet actif
    const usersTab = page.locator('.adm-tab', { hasText: 'Utilisateurs' })
    await usersTab.click()
    await expect(usersTab).toHaveClass(/adm-tab--active/, { timeout: 5_000 })

    // Puis basculer vers "Modules"
    const modulesTab = page.locator('.adm-tab', { hasText: 'Modules' })
    await modulesTab.click()
    await expect(modulesTab).toHaveClass(/adm-tab--active/, { timeout: 5_000 })
    await expect(usersTab).not.toHaveClass(/adm-tab--active/)
  })

})
