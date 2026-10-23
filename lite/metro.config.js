const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const defaults = require('./eas.json').build.preview.env;
for (const [key, value] of Object.entries(defaults)) if (!process.env[key]) process.env[key] = value;
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../expo')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
const dependencies = new Set(Object.keys(require('./package.json').dependencies));
// Shared source resolves Lite's direct dependencies (especially React). Nested
// dependencies still resolve relative to their own package, as npm requires.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = moduleName.startsWith('@') ? moduleName.split('/').slice(0, 2).join('/') : moduleName.split('/')[0];
  return context.resolveRequest(dependencies.has(name) ? { ...context, originModulePath: path.join(__dirname, 'index.ts') } : context, moduleName, platform);
};
module.exports = config;
