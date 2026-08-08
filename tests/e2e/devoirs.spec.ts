import { test, expect } from '@playwright/test'
import { startDemo, navigateTo } from './helpers'

test.describe('Devoirs', () => {

  test('enseignant demo : page devoirs affiche le header et le CTA "Nouveau devoir"', async ({ page }) => {
    await startDemo(page, 'Enseignant')
    await navigateTo(page, 'devoirs')

    // Le titre "Devoirs" du header doit etre rendu
    await expect(page.locator('.dh-title-text')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.dh-title-text')).toHaveText('Devoirs')

    // Le CTA "Nouveau devoir" est reserve aux enseignants
    await expect(page.locator('button:has-text("Nouveau devoir")')).toBeVisible({ timeout: 10_000 })
  })

  test('etudiant demo : page devoirs charge sans afficher le CTA enseignant', async ({ page }) => {
    await startDemo(page, 'Etudiant')
    await navigateTo(page, 'devoirs')

    // La zone devoirs doit etre rendue
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 10_000 })

    // Un etudiant ne doit pas voir le bouton de creation de devoir
    await expect(page.locator('button:has-text("Nouveau devoir")')).not.toBeVisible()
  })

})
