import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** vault 檔案的資源 URL。host 是假的（standard scheme 需要），路徑逐段編碼保留斜線 */
export function vaultUrl(path: string): string {
  return `vault://media/${path.split('/').map(encodeURIComponent).join('/')}`
}
