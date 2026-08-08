// Ambient declarations for Node.js globals used in E2E helpers.
// Needed because @types/node is not installed in this project.
declare const process: {
  env: Record<string, string | undefined>
}
