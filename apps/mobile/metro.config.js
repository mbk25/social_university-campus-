// Monorepo için Metro yapılandırması.
// Expo, workspace kökündeki node_modules'ı da izlemeli — aksi halde
// @kampus/shared ve hoist edilmiş bağımlılıklar çözümlenemez.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Aynı paketin iki kopyasının yüklenmesini engelle (React "invalid hook call").
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
