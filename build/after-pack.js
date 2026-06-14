const { execFileSync } = require('child_process')
const path = require('path')

// 未簽章發布：electron-builder 不做 Developer ID 簽章（mac.identity: null）。
// 這裡在 dmg/zip 打包前，對整個 .app 補上一份完整、有效的 ad-hoc 簽章，
// 否則 repackage 後的 bundle 簽章不完整，Apple Silicon 會以「檔案已損毀」拒絕啟動。
// 使用者下載後仍需先移除 quarantine（xattr -cr），見 README 下載說明。
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
