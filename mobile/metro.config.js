// Metro config para monorepo "lazy": Mobile vive en mobile/ y reusa el dominio
// que está en ../src. Por defecto Metro NO observa archivos fuera de su
// projectRoot, así que hay que extender watchFolders + nodeModulesPaths.
//
// Referencia oficial: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Observar el workspace root (incluye ../src del dominio)
config.watchFolders = [workspaceRoot];

// 2. Resolver módulos primero en mobile/node_modules y luego en el root
//    (por si en el futuro hay deps compartidas en el root).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Mantener lookup jerárquico habilitado (no es estrictamente un workspace
//    npm/yarn, así que dejamos que Metro suba por la jerarquía si hace falta).
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
