import { test, expect } from '@playwright/test'
import { SEL } from './helpers'

test.describe('Mode demo', () => {

  test('depuis le login : lien vers /demo affiche les 2 choix', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(SEL.emailInput, { timeout: 15_000 })
    // Le lien "Ou tester en démonstration" est visible sous le bouton register.
    // On cible par href plutot que par texte : insensible aux accents et a la
    // casse, et stable si on reformule le label.
    await page.click('a[href$="/demo"]')
    await expect(page).toHaveURL(/\/demo/, { timeout: 5_000 })
    // Les 2 cartes "role" doivent etre visibles
    await expect(page.locator('button:has-text("Etudiant")')).toBeVisible()
    await expect(page.locator('button:has-text("Enseignant")')).toBeVisible()
  })

  test('demarrage demo etudiant -> dashboard avec bandeau demo', async ({ page }) => {
    await page.goto('/#/demo')
    await page.click('button:has-text("Etudiant")')
    // Apres start, on est redirige vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
    // Le bandeau demo doit etre visible
    await expect(page.locator('text=/Mode demonstration/i')).toBeVisible({ timeout: 10_000 })
    // Le CTA "Creer un compte" est present
    await expect(page.locator('button:has-text("Creer un compte")')).toBeVisible()
  })

  test('demarrage demo enseignant -> session prof', async ({ page }) => {
    await page.goto('/#/demo')
    await page.click('button:has-text("Enseignant")')
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
    await expect(page.locator('text=/Mode demonstration/i')).toBeVisible({ timeout: 10_000 })
  })

  test('endpoints non couverts retournent un fallback (pas de 404)', async ({ page, request }) => {
    // Demarre une session demo et recupere le token
    const startRes = await request.post('/api/demo/start', { data: { role: 'student' } })
    const { data } = await startRes.json()
    const token = data.token

    // Endpoint inconnu : GET retourne ok+vide (fallback wildcard cf. demo.js)
    const fallback = await request.get('/api/demo/this-route-does-not-exist', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(fallback.status()).toBe(200)
    const body = await fallback.json()
    expect(body.ok).toBe(true)
    expect(body._demoFallback).toBe(true)

    // Endpoint d'ecriture inconnu : refus explicite 403
    const writeBlocked = await request.post('/api/demo/another-fake-endpoint', {
      headers: { Authorization: `Bearer ${token}` },
      data: { x: 1 },
    })
    expect(writeBlocked.status()).toBe(403)

    void page // signal a Playwright qu'on n'utilise pas la fixture page (mais on en a besoin
              // pour que `request` herite la baseURL du config)
  })
})
