import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, navigateTo, provisionStudent } from './helpers'

/**
 * Tests E2E : Vue Devoirs
 *
 * Parcours couverts :
 *   - Enseignant : navigation vers Devoirs, affichage de l'en-tête et du bouton "Nouveau"
 *   - Étudiant   : accès à la vue Devoirs sans erreur critique
 *     (état vide "Aucun devoir assigné" est acceptable)
 */

test.describe('Devoirs – Enseignant', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'devoirs')
  })

  test("affiche l'en-tête Devoirs et le bouton Nouveau", async ({ page }) => {
    // L'en-tête du module Devoirs doit être visible
    const header = page.locator('.devoirs-header')
    await expect(header).toBeVisible({ timeout: 10_000 })

    // Le libellé "Devoirs" doit apparaître dans le titre
    await expect(
      header.locator('span').filter({ hasText: 'Devoirs' }).first(),
    ).toBeVisible()

    // Le bouton "Nouveau" est réservé aux enseignants
    const btnNouveau = page.locator('.btn-nouveau')
    await expect(btnNouveau).toBeVisible()
    await expect(btnNouveau).toContainText('Nouveau')
  })
})

test.describe('Devoirs – Étudiant', () => {
  test.beforeAll(async () => {
    // Crée le compte de test si absent (idempotent : ignore 409)
    await provisionStudent()
  })

  test("étudiant accède à la vue Devoirs sans erreur critique", async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')

    // Le conteneur principal doit être monté
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // Aucun message d'erreur réseau ou de crash ne doit apparaître
    // L'état vide "Aucun devoir assigné" est un résultat valide
    await expect(
      page.locator('text=/impossible de charger|erreur inattendue/i'),
    ).not.toBeVisible()
  })
})
