import { test, expect, type Page } from '@playwright/test'

/**
 * Test E2E : Cycle enseignant-etudiant
 *
 * Prerequis :
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *   npm run server:dev  (backend sur :3001)
 *   npm run dev:web     (frontend sur :5174)
 *   Base seedee avec enseignant + etudiant
 *
 * Scenario :
 *   Enseignant cree un devoir → Etudiant le voit → Etudiant soumet → Enseignant voit le depot
 */

// Selecteurs reutilisables
const SEL = {
  emailInput: 'input[type="email"], input[placeholder*="email" i], input[name="email"]',
  passwordInput: 'input[type="password"]',
  submitBtn: 'button[type="submit"], button:has-text("Connexion")',
}

// Credentials du seed
const TEACHER_EMAIL = 'prof@cursus.school'
const TEACHER_PASSWORD = 'prof123'
const STUDENT_EMAIL = 'etudiant@cursus.school'
const STUDENT_PASSWORD = 'etudiant123'

// Titre unique pour le devoir cree pendant le test
const ASSIGNMENT_TITLE = `Devoir E2E ${Date.now()}`

/** Helper : connecter un utilisateur */
async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/')
  await page.fill(SEL.emailInput, email)
  await page.fill(SEL.passwordInput, password)
  await page.click(SEL.submitBtn)
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
}

/** Helper : deconnecter l'utilisateur courant */
async function logout(page: Page): Promise<void> {
  // Chercher le bouton de deconnexion dans la nav ou le menu utilisateur
  const logoutBtn = page.locator(
    'button:has-text("Déconnexion"), button:has-text("Deconnexion"), [data-testid="logout"], button[aria-label*="déconnexion" i], button[aria-label*="logout" i]',
  ).first()

  // Si un menu avatar/profil doit etre ouvert d'abord
  const avatarMenu = page.locator(
    '[data-testid="user-menu"], [data-testid="avatar"], .avatar-button, button[aria-label*="profil" i]',
  ).first()

  if (await avatarMenu.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await avatarMenu.click()
  }

  await logoutBtn.click({ timeout: 5_000 })

  // Verifier le retour a la page de login
  await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 10_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Les tests ci-dessous necessitent un serveur demarre et une base seedee.
// Ils sont marques test.skip pour ne pas echouer en CI sans infrastructure.
// Pour les executer localement : retirer le skip et lancer le serveur + seed.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cycle enseignant-etudiant : creation et soumission de devoir', () => {
  test.describe.configure({ mode: 'serial' })

  // SKIP : ces tests necessitent un serveur demarre avec seed data.
  // Retirer le skip pour execution locale avec : npx playwright test teacher-student-cycle
  test.skip(true, 'Necessite un serveur demarre et une base seedee (npm run server:dev + seed)')

  test('enseignant se connecte et accede au dashboard', async ({ page }) => {
    await login(page, TEACHER_EMAIL, TEACHER_PASSWORD)

    // Verifier que le dashboard enseignant est affiche
    await expect(
      page.locator('[data-testid="dashboard"], .dashboard, main').first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('enseignant cree un nouveau devoir', async ({ page }) => {
    await login(page, TEACHER_EMAIL, TEACHER_PASSWORD)

    // Naviguer vers la section devoirs
    await page.click('a[href*="devoirs"], [data-testid="nav-devoirs"], nav >> text=/devoirs/i')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // Cliquer sur le bouton de creation de devoir
    const createBtn = page.locator(
      'button:has-text("Nouveau"), button:has-text("Créer"), button:has-text("Ajouter"), [data-testid="create-assignment"], button[aria-label*="nouveau" i]',
    ).first()
    await createBtn.click({ timeout: 5_000 })

    // Remplir le formulaire de creation
    const titleInput = page.locator(
      'input[name="title"], input[placeholder*="titre" i], [data-testid="assignment-title"]',
    ).first()
    await expect(titleInput).toBeVisible({ timeout: 5_000 })
    await titleInput.fill(ASSIGNMENT_TITLE)

    // Description du devoir
    const descInput = page.locator(
      'textarea[name="description"], textarea[placeholder*="description" i], [data-testid="assignment-description"]',
    ).first()
    if (await descInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await descInput.fill('Description du devoir cree par test E2E')
    }

    // Soumettre le formulaire
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Enregistrer"), button:has-text("Créer"), button:has-text("Valider")',
    ).first()
    await submitBtn.click({ timeout: 5_000 })

    // Verifier que le devoir apparait dans la liste
    await expect(page.locator(`text=${ASSIGNMENT_TITLE}`)).toBeVisible({ timeout: 5_000 })
  })

  test('enseignant se deconnecte', async ({ page }) => {
    await login(page, TEACHER_EMAIL, TEACHER_PASSWORD)
    await logout(page)
  })

  test('etudiant se connecte et voit le nouveau devoir', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)

    // Naviguer vers la section devoirs
    await page.click('a[href*="devoirs"], [data-testid="nav-devoirs"], nav >> text=/devoirs/i')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // Le devoir cree par l'enseignant devrait etre visible
    // Note : le devoir n'apparaitra que si l'etudiant est dans la meme promo
    await expect(page.locator(`text=${ASSIGNMENT_TITLE}`)).toBeVisible({ timeout: 5_000 })
  })

  test('etudiant soumet un depot pour le devoir', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)

    // Naviguer vers les devoirs
    await page.click('a[href*="devoirs"], [data-testid="nav-devoirs"], nav >> text=/devoirs/i')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // Cliquer sur le devoir pour l'ouvrir
    await page.click(`text=${ASSIGNMENT_TITLE}`, { timeout: 5_000 })

    // Chercher le bouton de depot / soumission
    const submitDepotBtn = page.locator(
      'button:has-text("Déposer"), button:has-text("Soumettre"), button:has-text("Rendre"), [data-testid="submit-depot"], button:has-text("Upload")',
    ).first()

    if (await submitDepotBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Si un input file est present, simuler un upload
      const fileInput = page.locator('input[type="file"]').first()
      if (await fileInput.count() > 0) {
        // Creer un fichier temporaire pour le depot
        await fileInput.setInputFiles({
          name: 'devoir-e2e.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Contenu du devoir test E2E'),
        })
      }

      await submitDepotBtn.click()

      // Verifier la confirmation du depot
      await expect(
        page.locator('text=/déposé|soumis|envoyé|succès/i').first(),
      ).toBeVisible({ timeout: 5_000 })
    }
  })

  test('etudiant se deconnecte', async ({ page }) => {
    await login(page, STUDENT_EMAIL, STUDENT_PASSWORD)
    await logout(page)
  })

  test('enseignant voit le depot de l\'etudiant', async ({ page }) => {
    await login(page, TEACHER_EMAIL, TEACHER_PASSWORD)

    // Naviguer vers les devoirs
    await page.click('a[href*="devoirs"], [data-testid="nav-devoirs"], nav >> text=/devoirs/i')
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // Ouvrir le devoir
    await page.click(`text=${ASSIGNMENT_TITLE}`, { timeout: 5_000 })

    // L'enseignant devrait voir les depots des etudiants
    // Chercher un indicateur de depot (badge, liste, compteur)
    await expect(
      page.locator('text=/dépôt|depot|soumission|rendu/i').first(),
    ).toBeVisible({ timeout: 5_000 })
  })
})
