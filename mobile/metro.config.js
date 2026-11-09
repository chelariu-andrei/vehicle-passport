const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The 3D viewer ships as one self-contained HTML asset.
config.resolver.assetExts.push('html');

module.exports = config;
