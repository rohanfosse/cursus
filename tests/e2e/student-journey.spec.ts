import { test, expect, type Page } from '@playwright/test'

/**
 * Test E2E : Parcours etudiant complet
 *
 * Prerequis :
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *   npm run server:dev  (backend sur :3001)
 *   npm run dev:web     (frontend sur :5174)
 *   Base seedee avec au moins 1 etudiant dans la promo CPI A2 Informatique
 *
 * Ce fichier teste le parcours complet d'un etudiant :
 *   Login → Dashboard → Canal → Message → Devoirs → Documents
 */

// Selecteurs reutilisables
const SEL = {
  emailInput: 'input[type="email"], input[placeholder*="email" i], input[name="email"]',
  passwordInput: 'input[type="password"]',
  submitBtn: 'button[type="submit"], button:has-text("Connexion")',
}

// Credentials etudiant du seed (schema v12 + seed.js)
// En production, les etudiants sont crees par l'admin avec un mot de passe temporaire.
// Pour les tests E2E, on presume qu'un etudiant existe dans le seed avec ces credentials.
const STUDENT_EMAIL = 'etudiant@cursus.school'
const STUDENT_PASSWORD = 'etudiant123'

// Credentials enseignant (utilise dans auth.spec.ts)
const TEACHER_EMAIL = 'prof@cursus.school'
const TEACHER_PASSWORD = 'prof123'

/** Helper : connecter un utilisateur */
async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/')
  await page.fill(SEL.emailInput, email)
  await page.fill(SEL.passwordInput, password)
  await page.click(SEL.submitBtn)
}

// ─────────────────────────────────────────────────────────────────────────────
// Les tests ci-dessous necessitent un serveur demarre et une base seedee.
// Ils sont marques test.skip pour ne pas echouer en CI sans infrastructure.
// Pour les executer localement : retirer le skip et lancer le serveur + seed.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Parcours etudiant complet', () => {
  test.describe.configure({ mode: 'serial' })

  // SKIP : ces tests necessitent un serveur demarre avec seed data.
  // Retirer le skip pour execution locale avec : npx playwright test student-journey
  test.skip(true, 'Necessite un serveur demarre et une base seedee (npm run server:dev + seed)')

  test('login etudiant et acces au dashboard', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)

    // Apres login, redirection vers le dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Le dashboard devrait afficher des elements de contenu
    await expect(
      page.locator('[data-testid="dashboard"], .dashboard, main').first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('naviguer vers un canal et voir les messages', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Naviguer vers la section messages
    await page.click('a[href*="messages"], [data-testid="nav-messages"], nav >> text=/messages/i')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // Cliquer sur le canal "general" (present dans le seed pour toutes les promos)
    await page.click('text=/general/i', { timeout: 5_000 })

    // La zone de messages devrait etre visible
    await expect(
      page.locator('[data-testid="message-list"], .messages, .message-area, [class*="message"]').first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('envoyer un message dans le canal general', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Aller dans messages → general
    await page.click('a[href*="messages"], [data-testid="nav-messages"], nav >> text=/messages/i')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })
    await page.click('text=/general/i', { timeout: 5_000 })

    // Taper un message dans la zone de saisie
    const messageContent = `Message test E2E ${Date.now()}`
    const messageInput = page.locator(
      '[data-testid="message-input"], textarea[placeholder*="message" i], input[placeholder*="message" i], [contenteditable="true"]',
    ).first()
    await expect(messageInput).toBeVisible({ timeout: 5_000 })
    await messageInput.fill(messageContent)

    // Envoyer le message (Entree ou bouton)
    await messageInput.press('Enter')

    // Verifier que le message apparait dans la liste
    await expect(page.locator(`text=${messageContent}`)).toBeVisible({ timeout: 5_000 })
  })

  test('naviguer vers la section devoirs', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Cliquer sur le lien devoirs dans la navigation
    await page.click('a[href*="devoirs"], [data-testid="nav-devoirs"], nav >> text=/devoirs/i')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // La page devoirs devrait afficher une liste ou un tableau
    await expect(
      page.locator('[data-testid="devoirs-list"], .devoirs, main').first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('naviguer vers la section documents', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Cliquer sur le lien documents dans la navigation
    await page.click('a[href*="documents"], [data-testid="nav-documents"], nav >> text=/documents/i')
    await expect(page).toHaveURL(/documents/, { timeout: 10_000 })

    // La page documents devrait se charger
    await expect(
      page.locator('[data-testid="documents-list"], .documents, main').first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('le dashboard affiche les informations de la promo', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Le dashboard devrait afficher le nom de la promo de l'etudiant
    // (CPI A2 Informatique ou FISA Informatique A4 selon le seed)
    await expect(
      page.locator('text=/CPI|FISA|promo/i').first(),
    ).toBeVisible({ timeout: 5_000 })
  })
})
