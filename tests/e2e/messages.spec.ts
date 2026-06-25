import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages', () => {

  test('enseignant : sélection d\'un canal affiche l\'en-tête et la zone de saisie', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    await expect(page).toHaveURL(/messages/, { timeout: 10_000 })

    // Attendre que la liste des canaux dans la sidebar soit chargée,
    // puis cliquer sur le premier canal disponible.
    const firstChannel = page.locator('button.sidebar-item:has(.channel-name)').first()
    await expect(firstChannel).toBeVisible({ timeout: 15_000 })
    await firstChannel.click()

    // Après sélection d'un canal, l'en-tête et le champ de saisie doivent s'afficher
    await expect(page.locator('#channel-header')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 })
  })

  test('enseignant : le champ de message accepte la saisie clavier', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')

    const firstChannel = page.locator('button.sidebar-item:has(.channel-name)').first()
    await expect(firstChannel).toBeVisible({ timeout: 15_000 })
    await firstChannel.click()

    const input = page.locator('#message-input')
    await expect(input).toBeVisible({ timeout: 10_000 })

    // Le champ est éditable et restitue le texte tapé (valide que le binding v-model fonctionne)
    await input.fill('Test E2E cursus')
    await expect(input).toHaveValue('Test E2E cursus')
  })

})
