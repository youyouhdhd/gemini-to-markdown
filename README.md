# Gemini to Markdown · Research Archive

> 文档版本 v1.0
>
> 初版及最后更新 2026-11-19 21:13:10（UTC+08:00，Asia/Shanghai）
>
> 版本记录 v1.0 — 发布增强版安装、更新与导出指南。

用于归档 Gemini Deep Research、Canvas 和普通回复的轻量用户脚本。当前增强版 **1.8.0**，基于 [faithleysath/gemini-to-markdown](https://github.com/faithleysath/gemini-to-markdown) 的 **1.1**。需要 PDF、PNG 或 JSON 导出的用户可以使用配套 [Voyager 扩展](https://github.com/youyouhdhd/voyager)。

## 安装与更新

1. 在桌面 Chrome 安装 [Tampermonkey](https://www.tampermonkey.net/)。如果管理器提示需要允许用户脚本，请按提示在 Chrome 的扩展详情页启用对应选项。
2. 点击[安装增强版](https://raw.githubusercontent.com/youyouhdhd/gemini-to-markdown/refs/heads/deep-research-archive/gemini-to-markdown.user.js)，在 Tampermonkey 中确认安装。版本应显示 **1.8.0**，脚本名称仍是 **Gemini to Markdown Exporter**。
3. 刷新已打开的 [Gemini](https://gemini.google.com/) 标签页。报告和回复区域应出现**复制**与**导出**按钮。

已安装旧增强版或上游版的用户可使用安装链接覆盖更新。打开 Tampermonkey 管理面板确认只有一份脚本处于启用状态。增强版的自动更新指向本 fork 的 `deep-research-archive` 分支，也可从 [Releases](https://github.com/youyouhdhd/gemini-to-markdown/releases) 手动安装指定版本。

## 使用方法

1. 打开已完成的报告、Canvas 或普通回复。Deep Research 带内嵌网页时，等图表加载后再导出。
2. 在目标内容区域点击悬浮工具栏的 **Export / 导出**。选择 **Copy / 复制**可把 Markdown 文本放入剪贴板。
3. 普通内容通常保存为 `.md`。捕获到内嵌网页时，下载包含 `report.md`、`report.html` 和 `previews/` 的 ZIP。文件名以会话标题开头，时间跟随浏览器时区。

增强版归档会保存正文引用、参考来源、Gemini 页面已显示的 Thinking 内容，以及可捕获的内嵌网页。PNG 预览由网页内容离屏渲染，在正文原位置展示。点击图片或下方的 **Interactive HTML** 链接，可打开对应的本地 HTML。

请完整解压 ZIP，保持 `previews/` 与报告文件同级。在 Markdown Preview Enhanced 里可以直接看图。浏览器打开 `report.html` 可连续阅读并操作图表。若 VS Code 点击链接先打开 HTML 源文件，可将该文件交给浏览器打开。

## 常见问题

- **没有按钮**：确认 Tampermonkey 启用脚本并允许它在 Gemini 上运行。刷新网页后再打开目标报告。
- **只导出 Markdown，或只有标题链接**：先刷新 Gemini，再打开报告并等待网页预览出现。脚本从页面加载阶段开始捕获预览。网页捕获成功、静态转换失败时，标题仍链接到交互 HTML。
- **通过开发者工具粘贴脚本后少了图表**：改用用户脚本管理器安装，确保脚本从页面加载开始执行。
- **想复制给别人**：分享整个 ZIP，便于对方解压后保留本地路径。

## 维护、反馈与许可

脚本无构建步骤。修改后用 `node --check gemini-to-markdown.user.js` 检查语法，并用一份含预览的报告验证引用、Thinking、PNG 和本地链接。发布时递增 `@version`，使用 `research-v*` 标签并把同一份 `.user.js` 加到 GitHub Release。上游同步可先在独立分支验证再合并。

反馈时注明脚本版本、Chrome 和 Tampermonkey 版本，以及导出文件类型。请附去除私人内容的示例。[提交 Issue](https://github.com/youyouhdhd/gemini-to-markdown/issues)

保留原作者 faithleysath 和原贡献者署名。按 [MIT](./LICENSE) 发布。
