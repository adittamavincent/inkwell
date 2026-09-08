const isCI = !!process.env.CSC_NAME;

module.exports = {
  appId: 'com.inkwell.app',
  productName: 'Inkwell',
  npmRebuild: false,
  electronVersion: '33.2.1',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**/*', 'dist-electron/**/*', 'icons/**/*', 'package.json'],
  asarUnpack: ['**/*.node'],
  afterPack: 'build/afterPack.cjs',
  mac: {
    extendInfo: { LSUIElement: true },
    category: 'public.app-category.utilities',
    identity: isCI ? process.env.CSC_NAME : null,
    hardenedRuntime: isCI,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    target: [
      { target: 'dmg', arch: ['arm64'] },
      { target: 'zip', arch: ['arm64'] },
    ],
    icon: 'icons/icon.icns',
  },
  dmg: {
    sign: false,
    artifactName: '${productName}-${version}-mac-arm64.${ext}',
  },
};
