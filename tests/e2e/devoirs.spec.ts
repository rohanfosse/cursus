/**
 * Tests E2E – Devoirs
 *
 * Flows couverts :
 *   1. Étudiant : navigation vers /devoirs → page chargée sans erreur réseau
 *   2. Enseignant : navigation vers /devoirs → vue enseignant (pas l'état vide étudiant)
 *
 * Prérequis : le compte STUDENT est provisionné via API avant les tests.
 */
import { test, expect } from '@playwright/test'
import {
  TEACHER,
  STUDENT,
  loginAndWaitDashboard,
  navigateTo,
  provisionStudent,
} from './helpers'

test.describe('Devoirs', () => {
  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('étudiant : la page devoirs charge sans erreur', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // La zone racine devoirs est bien montée dans le DOM
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })

    // S'il y a un titre d'état vide visible, ce ne doit pas être une erreur réseau
    const esTitle = page.locator('.es-title')
    if (await esTitle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(esTitle).not.toHaveText(/Impossible de charger/i)
    }
  })

  test('enseignant : la page devoirs affiche la vue professeur', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')

    // Le conteneur de contenu devoirs est visible
    await expect(page.locator('.devoirs-content')).toBeVisible({ timeout: 15_000 })

    // L'enseignant ne doit jamais voir l'état vide réservé aux étudiants sans devoirs
    const esTitle = page.locator('.es-title')
    if (await esTitle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(esTitle).not.toHaveText('Aucun devoir assigné')
    }
  })
})
