// Déclaration minimale de process.env pour le type-check des tests e2e
// sans dépendance à @types/node (non installé localement)
declare const process: {
  env: Record<string, string | undefined>
}
