import { test, expect } from '@playwright/test'
import { startDemo } from './helpers'

/**
 * Verifie que le guard de route front (beforeEach dans router/index.ts)
 * bloque l'acces a /admin pour les roles insuffisants.
 * La route /admin requiert requiredRole: 'admin' (niveau 3).
 * Les roles 'student' (0) et 'teacher' (2) doivent etre rediriges vers /dashboard.
 */

test.describe('Route guards', () => {

  test('etudiant demo est redirige depuis /admin vers /dashboard', async ({ page }) => {
    await startDemo(page, 'Etudiant')

    // Tente d'acceder directement a la route admin
    await page.goto('/#/admin')

    // Le guard de role doit rediriger vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 })
  })

  test('enseignant demo est redirige depuis /admin vers /dashboard', async ({ page }) => {
    await startDemo(page, 'Enseignant')

    // Le role 'teacher' (niveau 2) est insuffisant pour /admin (niveau 3 = admin)
    await page.goto('/#/admin')

    // Le guard doit tout de meme rediriger
    await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 })
  })

})
