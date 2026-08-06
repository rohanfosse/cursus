import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

test.describe('Devoirs — enseignant', () => {

  test('affiche la vue devoirs après navigation', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // La zone principale devoirs est montée (indépendant de la présence de données)
    await expect(page.locator('.devoirs-area')).toBeAttached({ timeout: 15_000 })

    // ErrorBoundary ne doit pas avoir déclenché de fallback
    await expect(page.locator('text=/erreur inattendue|something went wrong/i')).not.toBeVisible()
  })

})

test.describe('Devoirs — étudiant', () => {

  test.beforeAll(async () => {
    // Crée (ou ignore si déjà existant) le compte étudiant de test
    await provisionStudent()
  })

  test('affiche la liste de devoirs étudiant après connexion', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Le conteneur principal est présent
    await expect(page.locator('.devoirs-area')).toBeAttached({ timeout: 15_000 })

    // La vue étudiant charge (squelettes ou contenu) — .devoirs-list est le wrapper
    // commun au chargement ET au contenu dans StudentDevoirsView
    await expect(
      page.locator('.devoirs-list, .devoirs-content'),
    ).toBeAttached({ timeout: 15_000 })

    // Aucune erreur fatale
    await expect(page.locator('text=/erreur inattendue|something went wrong/i')).not.toBeVisible()
  })

})
