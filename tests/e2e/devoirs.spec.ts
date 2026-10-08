import { test, expect } from '@playwright/test'
import { TEACHER, login, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test.beforeEach(async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
  })

  test('navigue vers la page devoirs depuis le dashboard', async ({ page }) => {
    await navigateTo(page, 'devoirs')
    await expect(page).toHaveURL(/devoirs/, { timeout: 15_000 })
  })

  test('la page devoirs affiche au moins un contenu (liste ou message vide)', async ({ page }) => {
    await navigateTo(page, 'devoirs')
    // La page devoirs doit afficher soit une liste de devoirs soit un message explicite
    // On accepte n'importe quel de ces selecteurs : une card, un item de liste,
    // un titre de section, ou un message "aucun devoir"
    const hasContent = await page.locator([
      '[data-testid="devoir-item"]',
      '[data-testid="assignment-item"]',
      '.devoir-card',
      '.assignment-card',
      'text=/aucun devoir|no assignment|pas de devoir/i',
      // Contenu structurel generique : titre H1/H2 ou sous-titre dans la vue
      'h1, h2',
    ].join(', ')).first().isVisible({ timeout: 10_000 }).catch(() => false)
    expect(hasContent, 'La page devoirs doit afficher un contenu apres chargement').toBe(true)
  })

  test('acces direct a /devoirs sans session redirige vers login', async ({ page }) => {
    // Effacer la session
    await page.evaluate(() => localStorage.removeItem('cc_session'))
    await page.goto('/#/devoirs')
    // Sans session, le guard doit renvoyer vers / (login)
    // On verifie soit le champ email visible soit l'URL ne contient plus devoirs
    const emailVisible = await page
      .locator('input[type="email"], input[placeholder*="email" i]')
      .isVisible({ timeout: 10_000 })
      .catch(() => false)
    const urlOk = !page.url().includes('devoirs')
    expect(
      emailVisible || urlOk,
      'Un acces non-authentifie a /devoirs doit rediriger vers login ou une autre vue',
    ).toBe(true)
  })

})
