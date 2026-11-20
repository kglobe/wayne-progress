# wayne-progress

herdr-app 右邊的一欄，列出每場 wayne-mode 跑到哪、卡在哪。資料來源是 wayne-mode 寫在 repo 根目錄的 `.wayne-mode-todo-<session>.md`，只讀不寫。

每場一張卡片：

- repo 名、狀態（等你、進行中、N 分鐘沒動、完成、停著）
- 進度條和 `做完/全部`
- 有 `[wait]` 的話，紅字寫在等什麼
- 目前這一步（▶）前兩步、後四步，其他收成「前面 N 步」「後面還有 N 步」
- 點卡片跳到那個 agent 的終端機

排序：等你的在最上面，再來是進行中，其他排後面。每 4 秒重讀一次。

## 安裝

需要 Windows 版 herdr-app、`node` 和 `git` 在 PATH 上，以及 herdr-notify-win 裝好的 `main-wintoast` layout。

```powershell
pwsh -File install.ps1
```

install.ps1 會：

1. 把 mod 複製到 `~/.config/herdr-app/mods/wayne-progress`（有設 `HERDR_APP_HOME` 就用那裡）
2. 在 `main-wintoast` 右邊加一欄，id 是 `wayne-progress`，寬 380
3. `keys.json` 加 `ctrl-shift-m` → `layout.toggle:wayne-progress`
4. 跑 `herdr-app check`

重跑不會重複加。

## 開關

`ctrl+shift+m`。

## 怎麼判斷哪份清單是現在這場

herdr 不會把 pane 或 session id 傳給 agent，所以用 repo 對：

- agent 的工作目錄往上找 git 根目錄，讀裡面的 todo 檔
- todo 檔做完不會刪，所以每個 repo 只取最新的 N 份，N 是那個 repo 裡 Claude Code agent 的數量
- 全部打勾、超過 30 分鐘沒動的不顯示
- 進行中、清單超過 10 分鐘沒動，標成「N 分鐘沒動」

已知限制：同一個 repo 跑兩場時，分不出哪張卡片是哪個 pane，狀態取比較急的那個。

## 測試

```powershell
npm test
```
