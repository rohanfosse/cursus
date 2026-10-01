import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant accede aux devoirs et voit la vue projets', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La zone principale de devoirs doit etre montee
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // L'en-tete devoirs est toujours presente (DevoirsHeader)
    // La vue enseignant (TeacherProjectHome) est rendue quand aucun projet n'est selectionne
    // On verifie que la page n'est pas vide : au moins un element enfant visible
    const content = page.locator('.devoirs-content')
    await expect(content).toBeVisible({ timeout: 10_000 })
    // Le contenu n'est pas vide (composant monte)
    await expect(content.locator(':scope > *').first()).toBeAttached({ timeout: 10_000 })
  })

  test('etudiant accede aux devoirs et voit sa liste de travaux', async ({ page }) => {
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La zone devoirs doit s'afficher pour l'etudiant
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // La vue etudiant est montee : soit un contenu, soit un etat vide
    // Dans les deux cas, .devoirs-content est rendu
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 10_000 })

    // Verifier que la session est bien celle d'un etudiant via localStorage
    const isStudent = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('cc_session')
        if (!raw) return false
        return JSON.parse(raw).type === 'student'
      } catch { return false }
    })
    expect(isStudent).toBe(true)
  })

})
