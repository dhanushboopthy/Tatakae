// Metro config for the pnpm monorepo.
// - watchFolders includes the repo root so edits in packages/core hot-reload and its TS source
//   (package.json "main": "src/index.ts") is transpiled by Expo's Babel preset like app code.
// - nodeModulesPaths lets Metro find hoisted/linked packages from both the app and the root.
//   Hierarchical lookup stays on, so packages/core resolves its own deps (zod) from
//   packages/core/node_modules under pnpm's isolated linker. Symlinks are followed by default.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
