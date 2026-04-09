// Minimal Node.js ambient types for the E2E test environment
// (replaces @types/node when node_modules is absent)
declare const process: {
  env: Record<string, string | undefined>
}
