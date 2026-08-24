import { test, expect } from '@playwright/test'
import { TEACHER, SEL, loginAndWaitDashboard } from './helpers'

/**
 * Persistance de session
 *
 * Complete auth.spec.ts (login OK / login KO / dashboard atteint) en verifiant
 * que la session survit a un reload de la page — le vrai signal que le JWT
 * stocke dans localStorage (cle `cc_session`) est correctement rehydrate par
 * `appStore.restoreSession()` au boot (cf. App.vue onMounted, l.337-338).
 *
 * Sans ce test, une regression qui casserait la lecture localStorage (parse
 * defectueux, key renommee, restoreSession non appelee) ne serait detectee
 * qu'a l'usage — l'utilisateur serait renvoye a la page de login a chaque F5.
 */
test.describe('Persistance de session', () => {

  test('la session survit a un reload de la page', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

    // Verifie que la session est bien stockee avant le reload
    const sessionBefore = await page.evaluate(() => localStorage.getItem('cc_session'))
    expect(sessionBefore, 'cc_session doit etre ecrit apres login').toBeTruthy()

    // Reload : le SPA se remonte, restoreSession() doit rehydrater currentUser
    await page.reload()

    // Signal fiable : app-shell (present uniquement quand appStore.currentUser
    // est defini). Si le reload avait perdu la session, on retomberait sur
    // LoginOverlay a la place.
    await page.waitForSelector('#app-shell, .app-shell, .app-columns', {
      state: 'attached',
      timeout: 20_000,
    })
    await expect(page.locator(SEL.emailInput)).toHaveCount(0)
  })

  test('logout puis reload : on revient bien a la page de login', async ({ page }) => {
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)

    // Suppression directe de la session (equivalent d'un logout cote store)
    // — evite la dependance a un bouton "Deconnexion" dont le selecteur
    // varie selon les evolutions UI. On teste la logique de garde, pas la
    // mecanique du menu utilisateur.
    await page.evaluate(() => localStorage.removeItem('cc_session'))
    await page.reload()

    // Sans session, App.vue rend <LoginOverlay/> — les inputs email/mdp
    // doivent redevenir visibles.
    await expect(page.locator(SEL.emailInput)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(SEL.passwordInput)).toBeVisible()
  })

})
