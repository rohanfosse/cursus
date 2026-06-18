import { test, expect } from '@playwright/test'
import { STUDENT, provisionStudent, loginAndWaitDashboard, navigateTo } from './helpers'

test.describe('Étudiant – authentification et devoirs', () => {

  test.beforeAll(async () => {
    await provisionStudent()
  })

  test('un étudiant peut se connecter et accéder au dashboard', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
    // Le shell applicatif doit être monté (même vérification que le test teacher dans auth.spec.ts)
    await expect(page.locator('#app-shell, .app-shell, .app-columns')).toBeVisible({ timeout: 10_000 })
  })

  test('la page /devoirs affiche la vue étudiant sans le bouton enseignant "Nouveau devoir"', async ({ page }) => {
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await navigateTo(page, 'devoirs')
    // Conteneur racine rendu par DevoirsView.vue
    await expect(page.locator('.devoirs-area')).toBeVisible({ timeout: 15_000 })
    // Le bouton "Nouveau devoir" est v-if="appStore.isTeacher" dans DevoirsHeader.vue —
    // il ne doit pas être présent pour un étudiant
    await expect(page.locator('.dh-new')).not.toBeVisible()
  })

})
