import { test, expect } from '@playwright/test'
import { TA, loginAndWaitDashboard } from './helpers'

/**
 * Garde de route /admin
 *
 * Le router (src/renderer/src/router/index.ts, beforeEach l.82-104) redirige
 * vers /dashboard toute navigation vers une route `requiredRole: 'admin'`
 * quand l'utilisateur n'a pas le niveau requis (cf. hasRole dans
 * utils/permissions.ts — hierarchie student(0) < ta(1) < teacher(2) < admin(3)).
 *
 * Ce guard est le seul rempart cote client pour empecher un TA/teacher/etudiant
 * d'atteindre la console admin (users, modules, deploy...). Une regression qui
 * echouerait a lire `cc_session.type` ou qui casserait `hasRole` laisserait
 * potentiellement passer des roles non privilegies. Ce test est un smoke test
 * simple mais critique.
 *
 * Note : on utilise le TA seede en v12 plutot que l'enseignant principal —
 * ce dernier a ete promu en 'admin' par la migration v42 et passe donc le
 * guard.
 */
test.describe('Garde de route /admin', () => {

  test('un TA est redirige vers /dashboard s\'il tente d\'acceder a /admin', async ({ page }) => {
    await loginAndWaitDashboard(page, TA.email, TA.password)

    // Le TA arrive sur /dashboard (ou /messages selon startView) — on force
    // ensuite la navigation vers /admin. On modifie le hash directement
    // plutot que d'appeler page.goto('/#/admin') : page.goto declenche un
    // full reload et App.vue re-execute son onMounted qui appelle
    // router.replace(resolveStartRoute()) — ce qui ecraserait la tentative
    // /admin avant meme que le guard puisse s'executer. Un hashchange
    // in-place laisse Vue Router seul aux commandes.
    await page.evaluate(() => { window.location.hash = '#/admin' })

    // Le guard doit avoir redirige vers /dashboard. On tolere que l'URL
    // finale contienne d'autres segments (ex: ?tab=... si le dashboard
    // memorise un onglet actif), mais elle NE doit PAS contenir /admin.
    await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 })
    await expect(page).not.toHaveURL(/#\/admin/)
  })

})
