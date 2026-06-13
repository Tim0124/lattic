import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * vault 檔案的資源 URL。host 是假的（standard scheme 需要），路徑逐段編碼保留斜線。
 * 帶 baseDir 時附上 `?base=`，讓 main 端優先以「相對該筆記資料夾」解析（支援相對路徑圖片）。
 */
export function vaultUrl(path: string, baseDir?: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const query = baseDir ? `?base=${encodeURIComponent(baseDir)}` : ''
  return `vault://media/${encoded}${query}`
}
