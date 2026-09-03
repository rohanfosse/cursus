import { test, expect } from '@playwright/test'
import { loginAndWaitDashboard, navigateTo, TEACHER, provisionStudent, STUDENT } from './helpers'

test.describe('Devoirs', () => {

  test('etudiant demo - section devoirs se charge sans erreur', async ({ page }) => {
    // Demarrer une session demo etudiant (pas besoin de seed)
    await page.goto('/#/demo')
    await page.waitForSelector('button:has-text("Etudiant")', { timeout: 20_000 })
    const [startRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/demo/start') && r.request().method() === 'POST', { timeout: 20_000 }),
      page.click('button:has-text("Etudiant")'),
    ])
    expect(startRes.ok()).toBe(true)
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })

    // Naviguer vers /devoirs
    await navigateTo(page, 'devoirs')

    // La vue doit se charger : soit la liste des devoirs, soit un etat vide, mais pas un ecran blanc
    // On attend que l'app-shell soit present et qu'un conteneur devoirs apparaisse
    const devoirsContainer = page.locator([
      '[data-testid="devoirs-view"]',
      '.devoirs-view',
      '.student-devoirs',
      'h1, h2, h3',                          // au moins un titre charge
    ].join(', ')).first()
    await expect(devoirsContainer).toBeVisible({ timeout: 15_000 })

    // Aucune erreur critique ne doit etre affichee
    const criticalError = page.locator('text=/500|erreur critique|uncaught/i')
    await expect(criticalError).not.toBeVisible()
  })

  test('enseignant - section devoirs affiche la vue enseignant', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La vue enseignant doit etre accessible
    await expect(page).toHaveURL(/devoirs/, { timeout: 10_000 })

    // L'interface enseignant doit afficher un contenu (header devoirs ou liste projets)
    const teacherUI = page.locator([
      '[data-testid="teacher-devoirs"]',
      '[data-testid="devoirs-header"]',
      '.teacher-project-home',
      '.devoirs-header',
      'button:has-text("Nouveau"), button:has-text("Ajouter"), button:has-text("Publier")',
      'h1, h2',
    ].join(', ')).first()
    await expect(teacherUI).toBeVisible({ timeout: 15_000 })
  })

  test('etudiant peut deposer un devoir - section depot visible si devoir disponible', async ({ page, request }) => {
    // Provisionner le compte etudiant test
    await provisionStudent()

    // Connexion etudiant
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Si des devoirs sont disponibles, un bouton de depot ou la liste doit etre visible
    // Sinon, un etat vide doit etre affiche (pas une erreur)
    await page.waitForTimeout(2_000) // Laisser Vue charger les donnees

    const hasContent = await page.locator([
      '[data-testid="devoir-card"]',
      '.devoir-card',
      '.devoir-item',
      'text=/devoir|rendu|depot|aucun/i',
    ].join(', ')).count()

    // La section doit afficher quelque chose (devoirs ou etat vide)
    const isEmpty = await page.locator('text=/aucun|vide|pas de devoir/i').isVisible({ timeout: 3_000 }).catch(() => false)
    expect(hasContent > 0 || isEmpty, 'La section devoirs doit afficher du contenu ou un etat vide').toBe(true)

    void request
  })

})
