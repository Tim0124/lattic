# TODO

VaultMind 待辦清單。核心四階段（瀏覽 / 搜尋 / 問答 / Agent）、三欄 UI、雙色主題、圖片/HTML 檢視、git、打包、README 皆已完成。

## 驗證債（需要實機操作確認，我無法代驗）

- [x] 深色模式對比：四組配色在 dark 模式下的對比度與可讀性
- [ ] Agent 寫入確認流程：實際跑一個會寫入的任務，確認「同意 / 拒絕」卡片行為正確
- [x] Vault 切換：設定頁「變更」按鈕選新資料夾後，樹會換掉、索引會重建
- [x] 圖片 / HTML 檢視：點 vault 內的圖片與 `.html` 能正確顯示、圖片縮放手感
- [x] 拖拉欄寬手感，以及重開 app 後欄寬是否記住

## 功能（依價值排序）

- [x] 手動「重建索引」按鈕（目前索引失敗只能等 vault 變動才重試）
- [x] 鍵盤快捷鍵（Cmd+K 聚焦搜尋、Cmd+, 開設定、Cmd+F 文內搜尋、Cmd+W 關閉分頁）
- [x] 中欄上方的麵包屑列改成多分頁 tabs（可同時開多篇筆記、分頁間切換與關閉）
- [x] 對話框打 `/` 跳出 vault 檔案選單可選（檔案引用 / mention），並換一個更好用的 AI chat input UI
- [x] 設定頁擴充：可選 chat / embed 模型、搜尋 top-k
- [x] Agent 新增 `append_note` 工具（追加比覆寫安全）
- [x] 欄位拖到底可自動收合（collapsible panels）
- [x] 問答對話歷史修剪（避免長對話超出模型 context；agent 已有，chat 還沒）
- [x] 多語系（i18n）：介面文字抽成字典、設定可切換語言（繁中 / English），預設跟隨系統。
      AI 回答語言不綁介面，跟隨使用者提問語言（未動 prompt）
- [x] 搜尋結果相關度門檻：低於 0.5 不顯示（至少保留最相關 1 筆避免空結果）

## 已知限制 / 技術債

- [ ] wikilink 前處理會誤轉 code block 內的 `[[...]]`
- [ ] `![[筆記]]` transclusion 只 render 成連結，不內嵌內容
- [ ] 圖片「相對於筆記資料夾」的路徑不支援（僅支援 vault 絕對路徑與純檔名）
- [ ] 預設 vault 路徑寫死於 `src/main/config.ts`，首次使用體驗待改善（理想為首次啟動引導選擇）
- [ ] 沒有任何自動化測試

## 收尾 / 正式化

- [ ] 替換預設 app icon（目前仍是 electron-vite 範本 icon）
- [ ] README 截圖：放 `docs/screenshot.png` 並打開引用
- [ ] 決定 License（自用維持現狀；若公開考慮 MIT）
- [ ] 統一品牌名稱（README 用 VaultMind，但 app 介面仍顯示「My Wiki」）
