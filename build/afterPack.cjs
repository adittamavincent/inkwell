const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  // electron-builder handles Developer ID signing when identity is configured.
  // This hook only strips quarantine attributes to prevent macOS "unidentified developer" warnings.
  console.log(`[afterPack] Stripping quarantine from ${appPath}...`);
  execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
};
