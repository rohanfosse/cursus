import { test, expect } from '@playwright/test'
import { TEACHER, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Messages – navigation et interface', () => {

  test("l'enseignant accède à la section messages et voit la liste des canaux", async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await navigateTo(page, 'messages')
    // Conteneur racine de MessagesView.vue (toujours rendu quelle que soit la sélection)
    await expect(page.locator('#main-area')).toBeVisible({ timeout: 15_000 })
    // L'en-tête de la section "Canaux" est rendu par Sidebar.vue (bloc v-else sur la route messages)
    // après la fin du chargement des données (skeleton → liste)
    await expect(page.locator('#sidebar-channels-header')).toBeVisible({ timeout: 15_000 })
  })

})
