import { describe, it, expect } from 'vitest'
import { vaultUrl } from './utils'

describe('vaultUrl', () => {
  it('P0 - 純檔名產生 vault://media URL', () => {
    expect(vaultUrl('pic.png')).toBe('vault://media/pic.png')
  })

  it('P0 - 多段路徑逐段編碼但保留斜線', () => {
    expect(vaultUrl('資料夾/圖.png')).toBe(
      'vault://media/%E8%B3%87%E6%96%99%E5%A4%BE/%E5%9C%96.png'
    )
  })

  it('P1 - 帶 baseDir 時附上 ?base= 供 main 端相對筆記解析', () => {
    expect(vaultUrl('pic.png', 'notes/sub')).toBe('vault://media/pic.png?base=notes%2Fsub')
  })

  it('P2 - baseDir 為空字串時不附 query', () => {
    expect(vaultUrl('pic.png', '')).toBe('vault://media/pic.png')
  })
})
