import { describe, it, expect } from 'vitest'
import { preprocessObsidian, createWikiResolver, extractSection } from './wikilink'

describe('preprocessObsidian', () => {
  it('P0 - 把 [[筆記]] 轉成 wiki: 連結', () => {
    expect(preprocessObsidian('看 [[架構]]')).toBe('看 [架構](wiki:%E6%9E%B6%E6%A7%8B)')
  })

  it('P0 - [[筆記|別名]] 用別名當顯示文字、target 仍是筆記', () => {
    expect(preprocessObsidian('[[架構|系統設計]]')).toBe('[系統設計](wiki:%E6%9E%B6%E6%A7%8B)')
  })

  it('P0 - ![[img.png]] 轉成 vault:// 圖片', () => {
    expect(preprocessObsidian('![[diagram.png]]')).toBe('![diagram.png](vault://media/diagram.png)')
  })

  it('P1 - ![[img.png|300]] 忽略尺寸參數', () => {
    expect(preprocessObsidian('![[diagram.png|300]]')).toBe(
      '![diagram.png](vault://media/diagram.png)'
    )
  })

  it('P0 - ![[筆記]] 轉成 transclude: 內嵌標記', () => {
    expect(preprocessObsidian('![[架構]]')).toBe('[架構](transclude:%E6%9E%B6%E6%A7%8B)')
  })

  it('P0 - transclude: false 時 ![[筆記]] 退回 wiki: 連結（單層內嵌防遞迴）', () => {
    expect(preprocessObsidian('![[架構]]', { transclude: false })).toBe(
      '[架構](wiki:%E6%9E%B6%E6%A7%8B)'
    )
  })

  it('P1 - ![[筆記#段落]] 內嵌標記保留錨點', () => {
    expect(preprocessObsidian('![[架構#第二節]]')).toBe(
      '[架構#第二節](transclude:%E6%9E%B6%E6%A7%8B%23%E7%AC%AC%E4%BA%8C%E7%AF%80)'
    )
  })

  it('P1 - 一行多個 wikilink 都會被轉換', () => {
    expect(preprocessObsidian('[[甲]] 和 [[乙]]')).toBe(
      '[甲](wiki:%E7%94%B2) 和 [乙](wiki:%E4%B9%99)'
    )
  })

  it('P2 - 前後空白會被 trim', () => {
    expect(preprocessObsidian('[[  架構  ]]')).toBe('[架構](wiki:%E6%9E%B6%E6%A7%8B)')
  })

  it('P0 - inline code 內的 [[...]] 保持原樣不轉換', () => {
    expect(preprocessObsidian('`[[架構]]`')).toBe('`[[架構]]`')
  })

  it('P0 - fenced code block 內的 [[...]] 與 ![[...]] 保持原樣', () => {
    const md = '```\n[[架構]]\n![[img.png]]\n```'
    expect(preprocessObsidian(md)).toBe(md)
  })

  it('P1 - code block 外的 wikilink 仍正常轉換', () => {
    expect(preprocessObsidian('看 `[[原樣]]` 再看 [[轉換]]')).toBe(
      '看 `[[原樣]]` 再看 [轉換](wiki:%E8%BD%89%E6%8F%9B)'
    )
  })
})

describe('createWikiResolver', () => {
  const notes = [
    { title: '系統架構', path: 'docs/系統架構.md' },
    { title: '索引', path: 'docs/索引.md' }
  ]

  it('P0 - 以標題解析出筆記路徑', () => {
    expect(createWikiResolver(notes)('系統架構')).toBe('docs/系統架構.md')
  })

  it('P0 - 以完整路徑（去副檔名）解析', () => {
    expect(createWikiResolver(notes)('docs/索引')).toBe('docs/索引.md')
  })

  it('P1 - 大小寫不敏感', () => {
    const notes2 = [{ title: 'README', path: 'README.md' }]
    expect(createWikiResolver(notes2)('readme')).toBe('README.md')
  })

  it('P1 - #段落錨點只取段落前的目標', () => {
    expect(createWikiResolver(notes)('系統架構#第二節')).toBe('docs/系統架構.md')
  })

  it('P2 - 找不到回 null', () => {
    expect(createWikiResolver(notes)('不存在')).toBeNull()
  })
})

describe('extractSection', () => {
  const md = ['# 前言', '開頭', '', '## 第二節', '內容 A', '內容 B', '', '## 第三節', '結尾'].join(
    '\n'
  )

  it('P0 - 取出指定標題到下一個同級標題前的內容', () => {
    expect(extractSection(md, '第二節')).toBe('## 第二節\n內容 A\n內容 B')
  })

  it('P1 - 取最後一個段落時延伸到結尾', () => {
    expect(extractSection(md, '第三節')).toBe('## 第三節\n結尾')
  })

  it('P1 - 更高級標題（level 1）會涵蓋其下所有子段落', () => {
    expect(extractSection(md, '前言')).toBe(md)
  })

  it('P1 - 標題比對大小寫不敏感、忽略前後空白', () => {
    expect(extractSection('## Intro\nhi', ' intro ')).toBe('## Intro\nhi')
  })

  it('P2 - 找不到段落回 null', () => {
    expect(extractSection(md, '不存在')).toBeNull()
  })
})
