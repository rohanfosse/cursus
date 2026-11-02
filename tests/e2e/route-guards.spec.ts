import { test, expect } from '@playwright/test'

/**
 * Verifie que le router guard (beforeEach) bloque l'acces aux routes protegees
 * selon le role de l'utilisateur.
 * Utilise le mode demo pour eviter la dependance a un compte etudiant seede.
 */
test.describe('Route guards', () => {

  test('un etudiant (demo) est redirige vers /dashboard depuis /admin', async ({ page }) => {
    // Demarrer une session demo etudiant
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.click('button:has-text("Etudiant")'),
    ])
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })

    // Tenter d'acceder a /admin (requiredRole: 'admin')
    await page.goto('/#/admin')
    // Le guard doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // La vue admin ne doit pas s'afficher
    await expect(page.locator('text=/administration|panneau admin/i')).not.toBeVisible({ timeout: 5_000 })
  })

  test('un etudiant (demo) est redirige vers /dashboard depuis /fichiers', async ({ page }) => {
    // Demarrer une session demo etudiant
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.click('button:has-text("Etudiant")'),
    ])
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })

    // Tenter d'acceder a /fichiers (requiredRole: 'teacher')
    await page.goto('/#/fichiers')
    // Le guard doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
