# Backup & Resilience

Guide opérationnel du système de sauvegarde SQLite de Cursus : architecture, procédures de restauration, monitoring, et scénarios de recovery.

## Architecture

Cursus utilise **une seule base SQLite** (`cursus.db`) qui contient toutes les données : utilisateurs, promos, messages, devoirs, documents, Lumen, audit log, etc. La résilience repose sur trois mécanismes complémentaires :

### 1. Backup quotidien automatique

[server/services/backup.js](../server/services/backup.js) démarre à T+5 min après le boot du serveur, puis toutes les 24 h. Chaque backup :

- utilise `VACUUM INTO` (SQLite 3.27+) qui produit un fichier propre et déduit (pas de WAL en cours),
- nomme le fichier `cursus-YYYY-MM-DDTHH-MM-SS.db` dans le dossier `BACKUP_DIR` (défaut : `<racine>/backups`),
- applique une rotation : on garde les **7 backups les plus récents**, les plus anciens sont supprimés automatiquement.

Le service est wired dans [server/index.js:313](../server/index.js#L313).

### 2. Restauration automatique au démarrage

À chaque appel de `getDb()` ([server/db/connection.js](../server/db/connection.js)), le serveur :

1. Tente d'ouvrir le fichier DB,
2. Lance un `PRAGMA integrity_check`,
3. Si **l'ouverture throw** (fichier totalement corrompu) **ou** si `integrity_check` retourne autre chose que `ok`, on :
   - déplace le fichier corrompu en `.corrupted`,
   - copie le backup le plus récent à sa place,
   - rouvre la DB proprement.
4. Si **aucun backup n'est disponible**, on passe en **mode dégradé** : le fichier corrompu est mis en quarantaine et une DB vide est créée. Le schéma sera réappliqué au prochain appel de `initSchema()`.

Les événements sont loggués via [logger.js](../server/utils/logger.js) avec les codes `db_open_failed`, `db_restored_from_backup`, `db_no_backup_available`.

### 3. Restauration manuelle (opérateur)

Un script CLI [scripts/restore-db.js](../scripts/restore-db.js) permet à un opérateur de restaurer un backup spécifique hors d'un redémarrage automatique (par exemple pour rollback après un bug applicatif qui a corrompu des données logiques sans déclencher `integrity_check`).

## Procédure de restauration manuelle

**Pré-requis** : arrêter le serveur avant toute manipulation du fichier DB.

### Lister les backups disponibles

```bash
node scripts/restore-db.js --list
```

### Restaurer le backup le plus récent

```bash
pm2 stop cursus-server
node scripts/restore-db.js
pm2 start cursus-server
```

### Restaurer un backup spécifique

```bash
pm2 stop cursus-server
node scripts/restore-db.js cursus-2026-04-07T03-00-00.db
pm2 start cursus-server
```

### Rollback si la restauration a été une erreur

Le script sauvegarde systématiquement le fichier courant sous `cursus.db.corrupted-<timestamp>` avant de copier le backup. Pour annuler la restauration :

```bash
pm2 stop cursus-server
mv cursus.db.corrupted-2026-04-08T10-30-00 cursus.db
pm2 start cursus-server
```

### Variables d'environnement

| Variable | Défaut | Usage |
|---|---|---|
| `DB_PATH` | `<racine>/cursus.db` | Chemin du fichier DB cible |
| `BACKUP_DIR` | `<racine>/backups` | Dossier contenant les backups |

En prod, `DB_PATH` pointe typiquement vers un volume persistant (`/var/lib/cursus/cursus.db`) et `BACKUP_DIR` vers un second volume (`/var/backups/cursus/`) idéalement monté sur un autre disque physique.

## Monitoring

### Endpoint admin

`GET /api/admin/backup-health` (admin système uniquement) renvoie :

```json
{
  "ok": true,
  "data": {
    "health": "ok",
    "count": 7,
    "latest": {
      "filename": "cursus-2026-04-08T03-00-00.db",
      "size": 4823040,
      "age_ms": 32145000
    },
    "staleThresholdMs": 172800000
  }
}
```

Valeurs possibles de `health` :
- **`ok`** : un backup existe et date de moins de 48 h
- **`stale`** : des backups existent mais le plus récent a plus de 48 h (le timer a probablement crashé — à investiguer)
- **`missing`** : aucun backup trouvé dans `BACKUP_DIR`

### Check externe (cron / uptime monitor)

```bash
curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://cursus.ecole.fr/api/admin/backup-health \
  | jq -e '.data.health == "ok"'
```

Return code 0 si `ok`, 1 sinon. À brancher dans UptimeRobot / Prometheus / cron.

### Déclencher un backup on-demand

`POST /api/admin/backup` (admin système) — utile avant une migration risquée ou un déploiement. Le backup est nommé selon le même pattern que les backups automatiques et entre dans la rotation.

## Scénarios de recovery

### DB corrompue au démarrage

→ Automatique. Le serveur restaure depuis le backup le plus récent au prochain boot. Vérifier les logs pour `db_restored_from_backup`.

### Perte totale du fichier DB et des backups

→ Mode dégradé : une DB vide est créée. Si vous avez un backup hors-site (rsync, S3), le restaurer manuellement :

```bash
pm2 stop cursus-server
cp /chemin/vers/backup/cursus-latest.db /var/lib/cursus/cursus.db
pm2 start cursus-server
```

### Rollback après bug applicatif (données supprimées par erreur)

→ `integrity_check` ne détectera pas ce type de corruption logique. Utiliser le script CLI pour restaurer un backup antérieur à l'incident :

```bash
pm2 stop cursus-server
node scripts/restore-db.js --list    # identifier le backup avant incident
node scripts/restore-db.js cursus-2026-04-07T03-00-00.db
pm2 start cursus-server
```

**Attention** : toutes les données postérieures à ce backup seront perdues (messages, devoirs rendus, documents ajoutés). Vérifier avec l'équipe pédagogique avant de procéder.

## Limites connues

- **Granularité journalière** : en cas de perte, on peut perdre jusqu'à 24 h de données. Pour un pilote CESI, c'est acceptable ; en prod large échelle, envisager WAL streaming (Litestream) ou un backup plus fréquent.
- **Pas de backup off-site par défaut** : les backups sont sur le même serveur que la DB. Pour le pilote, ajouter un cron externe qui `rsync` quotidiennement `BACKUP_DIR` vers un stockage hors-site (Nextcloud CESI, S3, rsync.net).
- **Pas de chiffrement des backups** : les backups contiennent des données personnelles RGPD. Les restreindre à un volume chiffré (LUKS) et limiter les accès SSH.

## Tests

Les tests de régression couvrent :
- **Création** : [tests/backend/services/backup.test.js](../tests/backend/services/backup.test.js) — VACUUM INTO, rotation 7 fichiers, intégrité du backup produit, health states, CLI du service.
- **Restauration automatique** : [tests/backend/db/restore.test.js](../tests/backend/db/restore.test.js) — corruption totale, choix du backup le plus récent, mode dégradé, non-déclenchement sur DB saine.
- **Endpoints admin** : [tests/backend/routes/admin-maintenance.test.js](../tests/backend/routes/admin-maintenance.test.js) — POST /backup, GET /backups, GET /backup-health, DELETE /backups/:filename avec validation anti-traversal.
