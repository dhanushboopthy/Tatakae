// Monorepo Metro config (Expo auto-detects workspaces since SDK 52).
// TODO(phase0): if @tatakae/core fails to resolve, set watchFolders to the repo root.
const { getDefaultConfig } = require("expo/metro-config");
module.exports = getDefaultConfig(__dirname);
