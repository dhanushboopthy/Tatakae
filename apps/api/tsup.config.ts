import { defineConfig } from "tsup";

// Merged with the CLI flags in package.json ("build"). @tatakae/core ships TypeScript source
// (main: src/index.ts), which plain node cannot load, so bundle it into dist/server.js.
// db/schema.ts is bundled too (relative import); npm dependencies stay external.
export default defineConfig({
  noExternal: [/^@tatakae\//],
});
