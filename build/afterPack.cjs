const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const entitlementsPath = path.join(__dirname, 'entitlements.mac.plist');

  const hasSigningIdentity = !!process.env.CSC_NAME;
  if (hasSigningIdentity) {
    console.log(`[afterPack] CSC_NAME set ("${process.env.CSC_NAME}"); skipping re-sign, stripping quarantine only.`);
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
    return;
  }

  console.log(`[afterPack] No CSC_NAME; signing ${appPath} locally and stripping quarantine...`);
  try {
    execSync(`codesign --force --deep --sign "Inkwell Dev" --entitlements "${entitlementsPath}" "${appPath}"`, { stdio: 'inherit' });
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterPack] Successfully signed with Inkwell Dev and stripped quarantine.');
  } catch (err) {
    console.warn('[afterPack] Inkwell Dev sign failed, falling back to ad-hoc codesign:', err.message);
    execSync(`codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${appPath}"`, { stdio: 'inherit' });
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
  }
};
