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

  test('demarrage demo etudiant -> dashboard avec session demo', async ({ page }) => {
    await page.goto('/#/demo')
    // Attente du bouton avant le clic (bundle peut etre lent en CI a charger
    // tous les chunks lazy-loadees)
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    // Click + attente explicite de la reponse POST /api/demo/start. Sans ca,
    // le test pouvait flake en CI quand le bundle prenait plus de temps que
    // prevu a hydrater le composant et a binder le handler @click.
    const [startRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.click('button:has-text("Etudiant")'),
    ])
    expect(startRes.ok()).toBe(true)
    // Apres start, on est redirige vers /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })
    // Verification de l'etat session via localStorage : le DemoBanner DOM
    // peut prendre plusieurs frames a hydrater en CI (chunks lazy), mais
    // localStorage est ecrit synchrone par appStore.login(). Plus stable.
    await expect.poll(async () => {
      return await page.evaluate(() => {
        try {
          const raw = localStorage.getItem('cc_session')
          if (!raw) return null
          return JSON.parse(raw).demo === true
        } catch { return null }
      })
    }, { timeout: 15_000 }).toBe(true)
  })

  test('demarrage demo enseignant -> session prof', async ({ page }) => {
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Enseignant")', { timeout: 20_000 })
    const [startRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.click('button:has-text("Enseignant")'),
    ])
    expect(startRes.ok()).toBe(true)
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })
    // Cf. test etudiant : on verifie via localStorage plutot que DOM banner
    // qui flake en CI a cause des chunks lazy.
    await expect.poll(async () => {
      return await page.evaluate(() => {
        try {
          const raw = localStorage.getItem('cc_session')
          if (!raw) return null
          const u = JSON.parse(raw)
          return u.demo === true && u.type === 'teacher'
        } catch { return null }
      })
    }, { timeout: 15_000 }).toBe(true)
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
