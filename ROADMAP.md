# Markdown-Editor 未来功能升级路线

本文件是 [README.md](./README.md) 中「未来功能升级」模块的展开版，记录规划背景、调研结论、技术方案与任务拆解。

> 状态标记：⬜ 待规划 ｜ 🟦 进行中 ｜ ✅ 已完成
> 优先级：**P0** 必做 ｜ **P1** 应该做 ｜ **P2** 可以做

---

## 目录

- [总览](#总览)
- [F1 · 导出能力（复制 MD / PDF / Word / HTML）](#f1--导出能力复制-md--pdf--word--html)
- [F2 · 界面与交互优化](#f2--界面与交互优化)
- [F3 · 主题模板体系](#f3--主题模板体系)
- [F4 · 文档元数据（Front Matter）解析与展示](#f4--文档元数据front-matter解析与展示)
- [F5 · 文件夹模式（打开整个文件夹并写回磁盘）](#f5--文件夹模式打开整个文件夹并写回磁盘)
- [F6 · 预览模式（设备档）](#f6--预览模式设备档)
- [非目标](#非目标)
- [维护约定](#维护约定)
- [参考链接](#参考链接)

---

## 总览

| 编号 | 模块 | 优先级 | 状态 | 依赖 | 预估工作量 |
|------|------|--------|------|------|------------|
| F1 | 导出能力（复制 MD / 导出 PDF / Word / HTML） | P0 | ✅ | 无 | 中 |
| F2 | 界面与交互优化 | P1 | ⬜ | 无 | 中～大 |
| F3 | 主题模板体系 | P1 | 🟦 部分 | 建议先解决内联样式问题 | 大 |
| F4 | 文档元数据（Front Matter）解析与展示 | P1 | ✅ | 无 | 小～中 |
| F5 | 文件夹模式（打开整个文件夹并写回磁盘） | P1 | 🟦 部分 | 无（建议先做只读的 F5-a） | 中～大 |
| F6 | 预览模式（设备档） | P1 | ✅ | 无 | 小～中 |

> **F3 标记为「🟦 部分」的原因**：2026-10-13 已落地**主题精简**（4 套 → 2 套：GitHub / 晴空蓝），并完成**两个外部对标站点的可行性调研**（独立文档 [F3-THEME-RESEARCH.md](./F3-THEME-RESEARCH.md)）；但主题体系的架构重构（内联样式、token → CSS、代码主题独立切换）尚未开始。

> **F5 标记为「🟦 部分」的原因**：2026-10-13 已落地只读的 **F5-a**（打开文件夹 + 文件树 + 切换文档 + 三层能力降级，2026-10-14 修订了入口收拢与抽屉开关），风险最高、才算「实时编辑」的写回（F5-b）与文件管理（F5-c）、外部修改检测（F5-d）均未做。**本期全程不写盘**。

**共同前置约束**：项目目前是「零构建 + CDN 引入」的纯静态三文件，任何新增依赖都要么走 CDN `<script>`，要么会引入构建步骤并改变「双击 `index.html` 就能跑」这一性质。引入前请先在此登记并同步更新 README。

> F5 是该约束的**例外**：它只用浏览器原生 API（File System Access API），零新增依赖、零构建步骤。但它带进了另一条前提——**需要安全上下文**（细节见 F5 章节的实测表）。

---

## F1 · 导出能力（复制 MD / PDF / Word / HTML）

> **状态：✅ 已实现**（2026-10-13）。落地文件：`index.html`（顶栏「导出」下拉 + 给两张 CDN 样式表打 `data-export-css` 标记）、`js/app.js`（`// ===== Export (F1) =====` 段，app.js:1041–1328；PDF 下载链路 `// ===== 导出 PDF（下载）=====` 段，app.js:1330–1496）、`css/style.css`（下拉样式 180–276，打印段 1621–1712）。动作与任务拆解全部落地，**零新增运行时依赖**（`cdn.jsdelivr.net` 引用仍是 9 处；`html2canvas` / `jspdf` 首次点击才动态加载）。落地过程中顺带修掉一条既有回归（`breaks: true` 破坏块级公式），与规划的 2 处偏差、四层实测记录见文末[「落地情况与实测记录」](#落地情况与实测记录)。

### 背景

项目当前**没有任何导出能力**——这是 README「已知限制」里的第 1 条。正文只存在 localStorage，换浏览器、清缓存即丢失，用户唯一的内容出口是「复制为富文本」。补齐导出是把工具从「能写」变成「能留存」的关键一步。

### 交互设计

在顶部右侧「复制」按钮旁新增**「导出」下拉菜单**，收纳四个动作，避免顶栏按钮继续膨胀：

- 复制 Markdown（源码）
- 导出 HTML
- 导出 PDF
- 导出 Word

四个动作统一通过**浏览器下载**落盘（`Blob` + `URL.createObjectURL` + `<a download>`），不经过任何服务端。

> **落地后的补充**：菜单最终是**五个动作**——上面这条「导出 PDF」原本指 `window.print()`（打印对话框 → 另存为 PDF），落地后拆成了**「导出 PDF」（直接下载图片型 PDF）** 与 **「打印」（原 `window.print()` 路径，矢量、文字可选）** 两项，见下方[「3. 导出 PDF」](#3-导出-pdf--两方案都做了各归其位)。

### 技术方案

#### 1. 复制 Markdown — 零依赖

```js
await navigator.clipboard.writeText(editor.value);
```

**坑**：Clipboard API 要求安全上下文（HTTPS 或 `localhost`）。README 目前允许以 `file://` 直接双击打开，该场景下 API 不可用，必须保留 `document.execCommand('copy')` 降级路径。

#### 2. 导出 HTML — 零依赖

拼一份独立可用的 HTML 文件：`getThemeStyles(theme)`（app.js:1002）输出的主题样式 + `preview.innerHTML` + 必要的外链 CSS。

**必须一并内联的样式，否则导出文件会变形：**

| 内容 | 原因 |
|------|------|
| 主题 CSS | 决定整体排版 |
| highlight.js 样式 | 代码高亮是 class 形式，脱离 CDN 即失效 |
| KaTeX 样式 | 公式依赖 `.katex-*` 系列 class，缺了会错位 |
| Mermaid | 已渲染为内联 SVG，无需额外处理 |

**⚠️ 落地时发现的隐藏坑：KaTeX 的 `@font-face` 写的是相对路径。** 它的样式里是 `url(fonts/KaTeX_Main-Regular.woff2)`，一旦把 CSS 文本内联进导出文件，相对路径就会以**导出文件所在目录**为基准解析，字体全部 404，公式退化成难看的回退字体。因此内联前必须先把 CSS 里的 `url(...)` 绝对化（`absolutizeCssUrls()`，app.js:1156），且要跳过已经是 `data:` / `http(s):` / `//` / `#` 的值。同理，若某张 CDN 样式表取不到文本（CSSOM 跨域抛 `SecurityError`，`fetch` 也失败），必须回退成 `<link>` 而不是静默丢弃。

#### 3. 导出 PDF — 两方案**都做了**，各归其位

原本是「二选一」，后来发现两者其实是**两种不同的产物形态**，用户点「导出 PDF」却弹出打印对话框，认知落差大。于是拆成两个菜单项、两条管线：

| 方案 | 归属 | 做法 | 优点 | 缺点 |
|------|------|------|------|------|
| **A** | 菜单项**「打印」** | `window.print()` + `@media print` 规则 | 零运行时依赖、矢量清晰、文字可选中、可选页边距/页眉页脚 | 需用户在打印对话框里再选「另存为 PDF」，多一步 |
| **B** | 菜单项**「导出 PDF」** | 离屏渲染 + A4 切片 + `jsPDF`（`html2canvas` + `jspdf`，**首次点击才从 CDN 懒加载**） | 一键直出、点一下就拿到 `.pdf` 文件 | 产物是**图片**，文字不可选中、不可检索；体积大于矢量版 |

B 落地时对原评估做了两处修正：① 中式排版与 KaTeX / Mermaid 的清晰度问题其实可接受——`scale` 取 2（受画布面积上限约束时自动降到 1.5 / 1），切缝用 `findBlankCut()` 找全白行，不会拦腰截断文字；② 「体积大」这一条通过 `getContext('2d', { alpha: false })` + `toDataURL('image/jpeg', 0.92)` 压下来了（10 页从 PNG 的 68 MB 降到约 1.1 MB）。**唯一不可回避的代价是文字不可检索**，这条已写进 Toast 与文档，并引导「要可检索就用打印」。超长文档撞上画布上限时会**明确拒绝并提示改用打印**，不交出截断文件。

注意：`css/style.css` 当时**完全没有 `@media print` 规则**（全文 0 处），走方案 A 必须补上，否则打印结果会带上顶栏、工具栏和编辑区。落地时已补齐——`@page { margin: 16mm }` 放在 `style.css:1758`（媒体查询**之外**），`@media print { … }` 主体在 `style.css:1762` 起，整段到 `:1842`（文末另有 `.btn-wechat` 一条，不属于打印段）。

#### 4. 导出 Word — 两方案二选一

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A（快速落地）** | 以 `application/msword` MIME 输出 `.doc` | 复用现有 HTML 渲染结果，改动极小 | 本质是 HTML 套壳，非真正 `.docx`；部分客户端会弹格式兼容性警告 |
| B（规范） | 用 `docx` 库生成真 `.docx` | 标准格式，Word/WPS 无警告 | 需把 Markdown AST 映射到 `Paragraph` / `Table` / `Image`，表格、代码块、公式、图片都得单独处理，工作量大且引入构建 |

### 任务拆解

- [x] 顶部新增「导出」下拉组件（HTML + CSS）：`#exportWrap` / `#btnExport` / `#exportMenu` + 5 个 `.export-item[data-export="md|html|pdf|word|print"]`，带 `role="menu"` / `aria-haspopup` / `aria-expanded`（`index.html:118–149`）
- [x] 抽出 `buildStandaloneHtml()`（规划里叫 `exportHtml()`）：主题样式 + hljs 样式 + KaTeX 样式内联，并先做 `url()` 绝对化
- [x] 实现复制 Markdown（含 `file://` / 非安全上下文下的 `execCommand('copy')` 降级路径）
- [x] 实现导出 HTML：**文件名按「元数据 `title` → 首个 H1 → `document`」取**（规划只写了「取首个 H1」），非法字符清洗 + 80 字符截断
- [x] 补充 `@media print` 样式（`style.css:1758` `@page` + `:1759` `@media print`），实现**「打印」**（原方案 A）
- [x] **新增「导出 PDF」下载链路**（原方案 B）：`exportPdfFile()` 离屏渲染 → A4 切片 → JPEG → `jsPDF` → `downloadBlob()`；两个库懒加载，不点不拉
- [x] 实现导出 Word（方案 A：`application/msword` + `.doc` 套壳；`WORD_COMPAT_CSS` 用 `pt` 兜底，元数据面板降级为两列表格）
- [x] 五个动作统一接入 Toast 成功/失败反馈；「导出 PDF」的 Toast 会说明产物是图片、要可检索请用「打印」
- [x] 下拉菜单宽度收缩到内容宽（`.export-menu { width: max-content }`，去掉 `.export-ext { margin-left: auto }` 造成的中缝）

### 验收标准

| # | 标准 | 结论 |
|---|------|------|
| 1 | 五种动作在 Chrome + Edge 均可落盘 / 可触发，文件名与内容正确 | ✅ 真实 Edge 走通；文件名 6 条规则有断言 |
| 2 | 导出的 HTML 断网后打开，代码高亮、公式、图表均正常 | ✅ 导出文件零外链、样式全内联；独立 `iframe srcdoc` 渲染核对 |
| 3 | 打印件不含顶栏与工具栏，分页处不切断代码块 | ✅ 打印件 4 页且只剩正文（截图对照）；`break-inside: avoid` 覆盖 `pre` / `blockquote` / `table` / 公式 / Mermaid |
| 4 | 导出的 Word 用 WPS 与 Word 打开均保留基本排版 | ✅ 结构已按 Word 的兼容性子集重写（见下）；观感需人工在不同客户端复核 |
| 5 | 在 `file://` 下打开时，复制 Markdown 仍能工作（走降级） | ✅ 降级分支有断言；且实测 `file://` 属安全上下文，`navigator.clipboard` 存在，降级只作兜底 |
| 6 | 「导出 PDF」产出的是一份能打开的 `.pdf`（而非打印对话框） | ✅ 真实浏览器跑通：`%PDF` 魔数 + `%%EOF`、≥2 页、MIME `application/pdf`、文件名 `.pdf`、10 页约 1.1 MB（原有 PNG 方案是 68 MB） |

### 落地情况与实测记录

规划与落地有 **2 处偏差**：

| 项 | 规划 | 落地 | 原因 |
|---|---|---|---|
| 导出 HTML 的文件名 | 取首个 H1，缺省 `document.md` | **优先取元数据 `title`，其次首个 H1，再兜底 `document`**；扩展名随动作变化（`.html` / `.doc`） | 文档常带 Front Matter，`title` 比正文 H1 更权威；无 H1 的文档用 `document` 兜底 |
| 导出函数命名 | `exportHtml()` | `buildStandaloneHtml()`（构建字符串）+ `runExport(kind)`（分派与 Toast） | 该动作要异步取 CSS 文本再拼串，命名体现「构建」而非「触发」 |
| 导出 PDF 的方案 | A / B 二选一 | **两个都做**，拆成「导出 PDF」（B，下载）与「打印」（A，矢量）两个菜单项 | 点「导出 PDF」却弹打印对话框认知落差大；两种产物各有不可替代的场合 |

**新增依赖：0（运行时）。** `index.html` 里的 `cdn.jsdelivr.net` 引用落地前后均为 **9 处**，外部 `<script>` 恰好 7 个，未引入任何库、未引入构建步骤——符合「共同前置约束」。「导出 PDF」用到的 `html2canvas` / `jspdf` **不在 `index.html` 里**，而是首次点击时由 `loadScriptOnce()` 动态插 `<script>`，所以常量依赖计数不变；测试侧这两个包只装进 `.workbuddy/tools/package.json`（dev-only），仓库本身仍无 `package.json`。

**顺带修复的既有回归（重要）**：`marked` 的 `breaks: true` 会把多行写的块级公式 `$$ … $$` 渲染成 `$$<br>…<br>$$`。KaTeX 的 auto-render 是按**文本节点**匹配定界符的，定界符被 `<br>` 拆开后就再也配不上，**整块块级公式完全不渲染**（行内 `$x$` 不受影响）。这条回归上一轮引入、此前未被任何测试覆盖，是真机核对验收标准 2 时暴露出来的。修复：在 `renderMath()`（app.js:651）开头新增 `unfoldDisplayMath()`（app.js:642）——对「整段就是一个块级公式」的段落，把 `<br>` 还原成 `\n`，合回单个文本节点。已补 9 条断言（`bq-test` 新增 B2 段 6 条 + A 段静态 3 条）。

**实测记录：四层验证共 435 条断言 0 失败**（`fm-unit` 96 + `fm-e2e` 86 + `bq-test` 88 + `ex-test` 165），另加真实浏览器核观感。

| 层 | 手段 | 覆盖 | 结果 |
|---|---|---|---|
| 静态 | 读 `index.html` / `style.css` / `app.js` 原文断言（读 CSS 前先剥注释） | 依赖数未变（`cdn.jsdelivr.net` 恰好 9 次、外部 `<script>` 恰好 7 个）、下拉结构 / aria / 五个 `data-export` / 两个 `data-export-css` 标记、导出函数签名、四种 MIME、复制降级分支、`removeAttribute('style')`、`classList.remove('grid-bg')`、`stripEditorOnlyAttrs()` 在两条克隆路径上都生效、图标声明已挂、样式侧 `.export-*` 与全部打印规则、PDF 链路的懒加载护栏 / 画布降档 / `alpha:false` + JPEG 0.92 / `findBlankCut()` | 65 / 65 |
| 端到端 | jsdom 加载真实 `index.html` + 真实 `app.js`，走**真实点击路径**；打桩 `URL.createObjectURL` 收集 Blob 读回文本、`navigator.clipboard.writeText`、`execCommand`、`window.print`、`fetch` 返回真实 hljs / KaTeX CSS | 菜单交互（Esc / 点外部关闭 / aria 同步）、复制 Markdown、降级路径、导出 HTML 的自包含性（hljs 真样式内联、KaTeX 字体 URL 绝对化、YAML 注释、水印 data URI、零 `<script>`、外壳样式排序）、文件名 6 条规则、导出 PDF、导出 Word 14 条、无元数据 / 换主题 / 取 CSS 失败吞异常 | 约 85 |
| 真实浏览器 · 交互 | 本机 Edge headless，真实 app + 真实 CDN | 下拉展开的几何与层级、**打印规则不泄漏到屏幕**（5 条） | 15 / 15 |
| 真实浏览器 · 产物 | ① 导出的 HTML 塞进 `iframe srcdoc` 独立渲染；② 真实 app `--print-to-pdf` 做带/不带打印样式的对比；③ 导出文件与 app 整页截图 | 零 `<script>`、零外链 `<link>`、h1 计算值 32px、`.hljs-keyword` 色值 `rgb(215,58,73)`、`pre` 背景；**带打印样式 4 页 / 去掉打印样式 1 页** | 通过 |

> **「4 页 vs 1 页」为什么是决定性证据**：去掉 `@media print` 时，三层滚动容器（`.preview-panel` → `.preview-wrap` → `.preview-scroll`）上的 `overflow: hidden` 会把内容**截断在第一屏**，所以只有 1 页；补上打印样式解除 `overflow` 之后内容才完整流出为 4 页。这说明打印样式确实同时解决了「摘掉界面壳子」与「内容不被截断」两件事。
>
> **截图对照**：`ex-app-screen.png`（真实 app 整屏）有顶栏 / 工具栏 / 编辑器 / 大纲 / 预览；`ex-app-printpreview.png`（把 `@media print` 的规则当普通样式注入后的「打印预览」）只剩正文——列表、引用、代码高亮、表格、行内与块级公式、任务列表、分界线、水印都在，界面元素一个不剩。

验证脚本：`.workbuddy/tools/ex-test.js`（本项目第 4 套回归）。F1 落地时 165 条，此后随功能增长（F6 预览模式档位、PDF 下载链路 C4 真实浏览器段等），**当前为 262 条**；跑法与既有三套一致：

```bash
cd .workbuddy/tools && npm i && node ex-test.js
```

**落地后补的小补丁（2026-10-13 同日）**：

- `index.html` 补站点图标声明 `<link rel="icon" href="Markdown.ico">`——复用仓库里既有的 `Markdown.ico`（蓝色底成品，桌面快捷方式同款），**不由本页生成、不另产配套图**。同日撤掉先前多出来的 `favicon.ico` 与 `apple-touch-icon.png`，只留一份。理由与改动见 [DESIGN §3.1](./DESIGN.md)。
- `data-page-node-id`（资料库页面平台给节点打的 `pnid`）会经 `preview.cloneNode(true)` 混进导出物与公众号内容 —— 新增 `stripEditorOnlyAttrs()`（app.js:919）在 `copyToClipboard()` 与 `clonePreviewForExport()` 两条克隆路径上剥掉，并补了 5 条断言（其中「导出 HTML 不含 `data-page-node-id`」在修复前必然失败）。**同日稍后确认全项目零处读取该属性，把 `index.html` 里的 312 处整批清除**；剥离逻辑保留做防御（文件若再被托管回资料库会重新出现），断言改为「手动注入 pnid → 导出应剥掉」。

**Word / PDF 的已知差异（属设计取舍，非缺陷）**：

- 导出 Word **不带水印**——预览 / 复制的水印走 SVG data URI 背景与绝对定位 `<span>`，Word / WPS 对这两者的支持都不可靠，故不写入。
- Word 里**元数据面板降级为两列表格**——Word 不认 flex，`fmPanelToTable()`（app.js:1215）在导出时把 `.fm-row` 递归摊平成 `<tr><td>键</td><td>值</td></tr>`，嵌套层级用缩进与 `、` 连接表达。
- 导出 Word **不认 `em` 单位**，`WORD_COMPAT_CSS` 一律用 `pt` 兜底；MSO 头（`<w:WordDocument><w:View>Print</w:View>` + `@page WordSection1`）负责让 Word 以「页面视图」打开。
- **「导出 PDF」的文字不可选中**——它是截图装箱，换来「点一下就拿到文件」；要矢量、可检索的 PDF 请用**「打印」**，在打印对话框里选「目标 → 另存为 PDF」。两条路都在菜单里，按需挑。

**实现中踩到并修掉的坑（按发现顺序）**：

1. **`@page` 漏写**——最初 `EXPORT_PAGE_CSS` 只写了 `@media print`，忘了 `@page`，导出文件打印时没有页边距。补在 `img` 规则之后。
2. **块级公式不渲染**（即上文那条既有回归）。
3. **`--print-to-pdf` 拿到 0 字节但退出码为 0**——Windows 上 Edge 是**启动器进程**，命令行进程立刻退出，PDF 由真正的浏览器进程**异步落盘**。必须轮询「文件存在且大小连续两次不变」才能认为产物完成。
4. **headless 下 CDN 没加载完就截图**——`--virtual-time-budget` 会把 `setTimeout` 的虚拟时钟提前推爆，探针在真实 CDN 回来之前就报了 `marked=undefined`，截图是白纸。做视觉核对时改为把 CDN 引用改指本机代理（内容仍取 jsDelivr 原文件，只是多了磁盘缓存），虚拟时钟才不再和真实网络打架；同时用页面探针回传 `editorLen` / `previewLen` / `katexNodes` 作为「确实渲染了」的证据，而不是靠猜等待时间。
5. **`indexOf('@media print')` 命中了注释里的同名字样**（`css/style.css` 打印段注释里的同名字样），导致抠出来的「打印样式」是旁边的 `@page` 块。改为用正则要求 `@media print` 后面真的跟 `{`。

---

## F2 · 界面与交互优化

### 现状问题清单（已逐项核实代码）

| 问题 | 代码依据 |
|------|----------|
| ~~无打印样式~~ | **F1 已补齐**：`css/style.css:1758` `@page` + `:1759` `@media print` |
| 无障碍属性覆盖极少 | 仅「导出」「打开」两个下拉带了 `role="menu"` / `aria-haspopup` / `aria-expanded`（`app.js:1631` / `:1663` 同步 `aria-expanded`）；其余按钮与弹窗仍无 `aria-label` / `role="dialog"` |
| 字体栈缺兜底 | 编辑器使用 `JetBrains Mono / Fira Code / SF Mono / Cascadia Code`，多数机器未安装，实际回退到系统默认，观感不一致 |
| 提示无分级 | `showToast(msg, type)` 支持 `success` / `error`，但调用处几乎只用 success；失败路径（如 URL 采集失败）反馈不足 |
| 危险操作确认覆盖不全 | 仅「打开文件」「清空内容」有 `confirm()`（app.js:1689 / 1706），删除模板等无确认 |
| Esc 关闭弹窗未统一 | 仅「水印」弹窗实现；模板 / URL / 更多工具三个弹窗缺失 |
| 无查找替换 | — |
| 无图片粘贴/拖拽上传 | 仅支持手写图片链接语法 |
| 无字号、行高、明暗主题调节 | — |
| 无响应式适配 | 分屏布局面向桌面端，窄屏下不可用 |

### 优化项

**1. 字体与排版**（P1）

- 重排字体栈，补上等宽与中文字体的显式兜底（`Consolas` / `Microsoft YaHei` / `monospace`）
- 编辑器字号、行高可调（写入 localStorage）
- 换行语义可配置：当前写死 `breaks: true`（单行换行 → `<br>`，见 DESIGN 第 8 节），英文硬换行习惯的用户需要一个开关
- 统一标题层级、间距、圆角、阴影的设计变量

**2. 交互效率**（P1）

- 查找 / 替换（`Ctrl+F` / `Ctrl+H`）
- 图片粘贴与拖拽自动上传（需先确定图床方案，涉及外部依赖，建议单独立项）
- 工具栏按钮补齐 tooltip，与快捷键标注保持一致
- 编辑器与预览区比例记忆（当前拖拽后刷新会重置）

**3. 提示与反馈**（P1）

- Toast 分级落地：成功 / 警告 / 错误三类样式与图标
- 危险操作统一二次确认（删除模板、清空、覆盖导入）
- 所有弹窗统一支持 Esc 关闭 + 点击遮罩关闭 + 焦点管理
- 首次使用引导（水印、模板、外链转脚注三个功能都不容易发现）

**4. 无障碍与键盘**（P2）

- 按钮补 `aria-label`，弹窗补 `role="dialog"` 与 `aria-modal`
- 弹窗打开时焦点移入、关闭后归还
- 支持纯键盘完成主要操作

**5. 响应式**（P2）

- 窄屏下编辑 / 预览切换为标签页而非分屏
- 工具栏在窄屏折叠

### 验收标准

1. 全部弹窗 Esc 与点击遮罩均可关闭，行为一致
2. 危险操作均有二次确认
3. 所有失败路径有明确错误提示
4. 键盘可完成「写入 → 套模板 → 加水印 → 复制」全流程
5. 在 1366×768 与 1920×1080 下均无横向滚动条

---

## F3 · 主题模板体系

> **状态：🟦 部分落地**（2026-10-13）。已落地**主题精简**（4 套 → 2 套）与**两个外部对标站点的可行性调研**；架构重构尚未开始。
> **完整调研与可行性分析见独立文档 → [F3-THEME-RESEARCH.md](./F3-THEME-RESEARCH.md)**（含 `md.axiaoxin.com` / `md.payforchat.com` 的取证、License 判定与迁移建议）。本文件只保留结论摘要。

### 调研结论

| 项目 | License | 主题机制 | 主题数量 | 复制到公众号 |
|------|---------|----------|----------|--------------|
| [doocs/md](https://github.com/doocs/md) | **MIT** | `src/config/theme.ts` 三段式配置（Base / Block / Inline Elements）+ 自定义 CSS 编辑器（`css2json`、`customCssWithTemplate`、`customizeTheme`） | 3 套内置：`default`（经典）/ `grace`（优雅）/ `simple`（简洁）；可叠加自定义主题色（11 种预设 + 取色器）、字体（无衬线 / 衬线 / 等宽）、字号 14–18px、代码块主题、图注格式 | 支持 |
| [mdnice / markdown-nice](https://github.com/mdnice/markdown-nice) | **GPL-3.0** | 主题为整段 CSS，另提供 Mac 风格代码块 | 20 套文章主题 + 7 套代码主题 | 支持（公众号 / 知乎 / 掘金） |
| `md.axiaoxin.com`（人言兑.md，**mdnice 的 Fork**） | **GPL-3.0** | JS 数组 `{themeId, name, css, isDark}` 运行时注入 `<style id="markdown-theme">`；选择器挂 `#nice` | **101 套 + 默认 + 自定义** | 支持，用 `juice.inlineContent()` 做 CSS 内联 + 公式图片化 |
| `md.payforchat.com`（MarkCopy，**闭源**） | **未能获取** | **token 对象 → 拼 CSS 字符串**（`tE(tokens)`）运行时注入；选择器挂 `.preview-body` | 13 套 + 主题实验室 | 支持，自研 `getComputedStyle` 遍历内联 + 列表文本化 + 图片 base64 |
| **本项目现状** | **MIT** | CSS class 前缀 `.theme-*`，样式写在 `style.css` | **2 套：GitHub / 晴空蓝**（2026-10-13 精简） | 支持，但有风险（见下） |

**mdnice 20 套主题**：默认、山吹、蔷薇紫、全栈蓝、凝夜紫、萌绿、极简黑、橙心、墨黑、姹紫、绿意、嫩青、WeChat-Format、兰青、前端之巅同款、极客黑、红绯、蓝莹、科技蓝、简
**mdnice 7 套代码主题**：atom-one-dark、monokai、github、vs2015、atom-one-light、xcode、wechat

### ⚠️ License 风险（务必先看）

本项目是 **MIT**，而 mdnice 是 **GPL-3.0**——**直接搬运其主题 CSS 会因 GPL 的传染性，要求本项目整体转为 GPL-3.0**。
本次调研进一步确认：**`md.axiaoxin.com` 是 mdnice 的 Fork，同样是 GPL-3.0**（其线上 101 套主题全在这条许可链上）；`md.payforchat.com` 则是**闭源商业产品，无许可证声明**，不存在搬运源码的合法路径。

可选处理：

1. **只借鉴配色与结构思路，按本项目前缀自行重写**（推荐，保持 MIT）
2. 明确改用 GPL-3.0 并在 README 声明来源与许可变更

doocs/md 为 MIT，参考与借鉴其主题结构没有该风险，优先以它为蓝本；站点 B 的 **token → CSS 生成器**结构最轻，也值得自研复刻（见 F3-THEME-RESEARCH.md §5.1）。

### 关键技术约束（决定成败）

微信编辑器会过滤 `<style>` 标签与 class，**主题样式必须内联到每个元素的 `style` 属性上**。

> **本次调研修正了一条推论**：两站（mdnice 系 / MarkCopy）的实际做法都是**「预览期照样用 `<style>`，只在复制那一刻做内联」**——A 用 `juice.inlineContent()`，B 用 `getComputedStyle` 遍历。也就是说**不必把整条渲染管线改成「输出内联 style」**，本项目现有的「class 预览 + 复制时 `getThemeStyles()` 内联」是同一种思路，只是内联的覆盖面还不够。这大幅降低了 F3 的改造量。

本项目当前的复制路径是注入一整个 `<style>` 块（`getThemeStyles()`，app.js:1002），存在被微信剥离的风险——这是 F3 必须一并解决的前置问题。

参考 doocs/md 的做法：把主题定义为**样式配置对象**，通过 marked 的自定义 `RendererObject` 在渲染时把样式写进每个标签的 `style`，而不是输出 class + 外部样式表。

### 设计建议

- **文章主题**：~~先做 6 套~~ → 调整为**先把 2 套做扎实**（GitHub / 晴空蓝），再按需扩。暗色主题会带来打印（浏览器默认不打印背景）与复制（微信白底）的一系列额外问题，**建议后置**
- **主题数据结构**：优先采纳站点 B 的**「token 对象 → 拼 CSS 字符串」**轻生成器（见 F3-THEME-RESEARCH.md §5.1）。一处 token 同时驱动「预览的 `<style>`」与「复制的内联样式串」，直接消灭本项目「改主题色要顾四处」的痛点，且零新增依赖
- **代码主题**：与文章主题解耦、独立切换 —— atom-one-dark / github / monokai / xcode / vs2015
- **主题色**：支持取色器覆盖主色（背景留白由主题决定，避免用户调出不可读的配色）
- **自定义 CSS**：进阶能力，提供选择器模板供用户覆写

### 任务拆解

- [ ] 重构渲染管线：自定义 `RendererObject`，输出内联 style（**前置项**，但见上文的调研修正——可只作用于复制路径）
- [ ] 定义主题数据结构（优先走「token → CSS」；若沿用三段式则参考 doocs/md）
- [ ] 迁移现有 **2 套**主题到新结构
- [ ] 新增优雅 / 极简 / 科技蓝等主题（自研，避免 GPL 风险）
- [ ] 代码主题独立切换（接入 hljs 多套样式）
- [x] 主题选择器在顶栏露出（原被 `display:none` 隐藏）——**2026-10-13 已放开**
- [x] 主题精简：4 套 → **2 套**（GitHub / 晴空蓝），旧档位存档值自动收敛（`THEME_ALIASES`，app.js:11）
- [x] 主题选择写入 localStorage
- [ ] 在真实公众号后台验证粘贴效果
- [ ] 复制时补齐三个微信坑：公式图片化、列表 `::before` 文本化、外链图片转 base64（可在 F1 的导出链路上复用）

### 验收标准

1. 切换主题后预览即时生效，刷新后保持
2. 复制粘贴到公众号后台，样式**完整保留**（不依赖 `<style>` 标签）
3. 代码主题可独立于文章主题切换
4. 新增主题只需追加一份配置，不改渲染逻辑
5. 全部主题样式为自研或来自 MIT 项目，README 中标注来源

### 落地情况（2026-10-13）

**已完成的部分**：

| 项 | 结果 |
|----|------|
| 主题精简 | 下线「山月」「凝夜紫」，保留 GitHub +「山吹」；「山吹」更名**晴空蓝**（id `shanchui` → `qingkong`） |
| 旧存档迁移 | `THEME_ALIASES`（app.js:11）把 `shanchui → qingkong`、`shanyue / condensed-night-purple → github`，老用户不会落到空主题；`normalizeTheme()` 兜底任意非法值 |
| 改动落点 | `index.html`（下拉只剩 2 项）、`css/style.css`（删 2 个主题块，1401 → 1391 行）、`js/app.js`（`FM_PALETTE` / `getThemeStyles()` 同步，初版为 4 处平行维护） |
| 断言 | `ex-test` A 段锁住「只剩 2 个主题段 / 下拉 2 项 / 旧 id 已清干净」+ B9 换主题导出配色；`fm-unit` / `fm-e2e` / `bq-test` 的主题清单同步为 2 套 |
| 外部调研 | 两个对标站点的取证与可行性分析 → [F3-THEME-RESEARCH.md](./F3-THEME-RESEARCH.md) |

**明确未做**：内联样式重构、token → CSS 生成器、代码主题独立切换、主题色取色器。

---

## F4 · 文档元数据（Front Matter）解析与展示

> **状态：✅ 已实现**（2026-09-20）。落地文件：`index.html`（js-yaml CDN + 档位控件 + 状态栏提示）、`js/app.js`（`splitFrontMatter` / `buildFrontMatterBlock` / `fmTypeOf` / `FM_ICON_PATHS` 等）、`css/style.css`（`.fm-block` / `.fm-tag` / `.status-meta`）。展示形态最终定为 **Obsidian 风格的「属性」面板**——初版按本规划做了 GitHub 式两列表格，同日评审后按用户要求换风格。实现与规划的 **3 处偏差**、以及实测记录见文末[「落地情况」](#落地情况)。

### 背景

从 Typora / Obsidian / VSCode 导出，或来自 Hexo、Hugo、Jekyll 等静态站点生成器的 `.md` 文件，通常会在文件首部带一段 **YAML Front Matter**（以 `---` 包裹的键值块），用来承载 `title` / `author` / `date` / `tags` / `description` 等文档元数据。这类文件是「打开本地文件」功能的主要输入，而项目当前**完全没有处理它**——一打开预览就会出现类似乱码的输出。

### 现状：实测的渲染结果

`js/app.js` 全文检索 `front` / `yaml` / `meta` 均无命中，`renderMarkdown()`（app.js:547）把整份源码直接交给 `marked.parse()`。marked v4 不认识 front matter，按 CommonMark 规则处理。用项目锁定的 **marked 4.3.0** 离线复现，输入：

```markdown
---
title: 示例文章标题
author: 张三
date: 2026-09-20
tags: [markdown, wechat]
draft: false
---

# 正文一级标题
```

输出：

```html
<hr>
<h2 id="title-示例文章标题-author-张三-...">title: 示例文章标题
author: 张三
date: 2026-09-20
tags: [markdown, wechat]
draft: false</h2>
<h1 id="正文一级标题">正文一级标题</h1>
```

即：首个 `---` 变成分割线，收尾 `---` 触发 setext 标题语法，把**整段元数据吞成一个 `<h2>`**。

由此派生的三个连带问题：

| 连带问题 | 原因 |
|---|---|
| 大纲左右不一致 | `getSourceHeadings()` 只扫源码的 ATX 标题（`#`），预览侧多出这个假 `<h2>`，`buildOutline()` 的「层级 + 文本」匹配会错位 |
| 自动编号被污染 | `applyAutoNumbering()` 会把假 `<h2>` 一并编号 |
| 字数统计偏大 | `updateCounts()` 把元数据原文计进字符数 / 词数 |

### 调研结论：同类型工具怎么做

| 工具 | 是否识别 | 展示形态 |
|------|----------|----------|
| **GitHub**（网页渲染 `.md`） | ✅ | 文件顶部渲染为**两列 key / value 表格**，不隐藏 |
| **VS Code**（内置 Markdown 预览，1.121+） | ✅ | 新增 `markdown.preview.frontMatter` 设置，三档：`table`（**默认**）/ `codeBlock` / `hide`，并在渲染出的 front matter 上提供右键菜单快速切换 |
| **Obsidian** | ✅ | 「属性 / Properties」面板：表格式行，左侧属性名，**按类型渲染**——文本 / 列表 / 数字 / 复选框 / 日期 / 日期&时间 / 标签；显示模式三档：Visible（默认）/ Hidden / Source |
| **Typora** | ✅ | 支持 YAML front matter，可在设置中隐藏 |
| **doocs/md**（MIT，本项目 F3 蓝本） | ✅ | `parseFrontMatterAndContent()` 在 `marked.parse` **之前**剥离，`yamlData` 用于标题 / 作者与**阅读时长**区块（`buildReadingTime()`），正文中不再出现元数据 |
| **mdnice** | ❌ 无处理 | — |
| 裸 CommonMark 渲染器（**本项目现状**） | ❌ | `<hr>` + 整段元数据被吞成一个 `<h2>` |

结论：**主流工具的默认做法是在预览顶部渲染为可见的键值形态**（GitHub 与 VS Code 的默认档完全一致），而非隐藏。隐藏式（Obsidian 阅读视图、静态站点生成器）适合「元数据只给机器读」的场景，但会让作者失去对元数据的可见反馈，因此本项目取「显示为面板」作为默认。

> **落地修正（2026-09-20）**：具体形态最终取 **Obsidian 的「属性」面板**，而不是 GitHub 的两列表格。两者同属「可见的键值展示」，但用**类型图标 + 定宽键列 + 标签胶囊**替代表格线，观感更轻，也更贴合本项目「元数据是一份文档的抬头」的定位。三档显示模式与 `mdtu-frontmatter` 键沿用 VS Code 的做法不变。

### 标准格式定义（建议）

对齐 VS Code 的 `table` / `codeBlock` / `hide` 三档，形态采用 Obsidian 的「属性」面板。

**1. 位置**：正文最顶部，独立成块；面板与正文之间留 24px 间距。

**2. 结构**：圆角卡片，一行一个属性 —— `类型图标 + 键 + 值`，键列定宽（各行的值左边缘对齐），行与行之间一条极淡分隔线

| 类型图标 | 键 | 值 |
|---|---|---|
| 文本 | `title` | 示例文章标题 |
| 文本 | `author` | 张三 |
| 日历 | `date` | `2026-09-20` |
| 标签 | `tags` | `markdown` `wechat`（胶囊标签） |
| 复选框 | `draft` | ✗ |

卡片顶部一行 `属性 · n 项` 小标题（属应用 UI，复制到公众号时会被摘掉）。

**3. 值的类型化呈现**（借 Obsidian 的类型观，避免把数组 / 布尔值直接 `String()` 出来）

| YAML 值类型 | 渲染 |
|---|---|
| 字符串 | 原样输出（做 HTML 转义） |
| 数字 | 原样输出 |
| 布尔 | `✓` / `✗`（比 `true` / `false` 更易读） |
| 数组 | 渲染为胶囊标签——`tags` 因此天然是标签样式（`keywords` / `categories` 等同理）；单值写法也按标签渲染 |
| 日期 | 归一化为 `YYYY-MM-DD`（面板取 CORE_SCHEMA，不做时区位移） |
| 对象 / 嵌套 | 折叠为 `key: value` 内联串，不做递归（对齐 Obsidian「不支持嵌套属性」的取舍） |

**4. 三档显示模式**（localStorage 键 `mdtu-frontmatter`，对齐 VS Code）

| 模式 | 行为 |
|------|------|
| `panel`（**默认**） | 渲染为「属性」面板（初版名为 `table`，读取时会自动迁移） |
| `codeBlock` | 渲染为 YAML 代码块（保留原文，走 hljs 的 `yaml` 高亮） |
| `hide` | 预览中完全不出现元数据 |

**5. 两条硬约束**

- **不改动源码**：只影响预览与复制结果，textarea 里的原文一字不动（与水印的既有约定一致）。
- **元数据不参与正文派生逻辑**：不计入字数统计、不进入目录大纲、不参与自动编号；且三档模式切换时统计数字不应跳动。

### 技术方案

#### 1. 剥离时机 —— 必须在 `marked.parse()` 之前

```js
const { yaml, body } = splitFrontMatter(editor.value);
let html = marked.parse(body);
```

不要尝试用 marked 扩展机制：v4 无 front matter 扩展，且现有的 `breaks` / `gfm` / `headerIds` 等配置不应受影响。

#### 2. 识别规则（正则，已实测）

```js
/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
```

- 只认**文件首行**的 `---`，允许前置 BOM 与 CRLF
- 实测：104 字符源码剥离后 body 剩 16 字符，首行为空行，渲染输出干净
- 容错：闭合 `---` 缺失、YAML 语法非法时**整块按正文处理**（等价于现状），绝不能因为元数据写错就让预览空白

#### 3. YAML 解析 —— 新增唯一依赖 js-yaml

| 方案 | 取舍 |
|------|------|
| **js-yaml 4.1.0（推荐）** | CDN `https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js`（**39.4 KB**，UMD 暴露全局 `jsyaml`），符合「共同前置约束」的 CDN 路线，不引入构建 |
| 手写迷你解析器 | 零依赖，但要覆盖引号转义、行内数组、块状数组、多行折叠标量，边界远比预想多，不建议 |
| `front-matter`（doocs/md 所用库） | 依赖 Node 的 `Buffer`，不适合纯静态页面，排除 |

**⚠️ 实测坑：必须显式指定 schema，否则日期会被类型化**

`jsyaml.load()` 默认走 `DEFAULT_SCHEMA`（YAML 1.1）。实测三种 schema 对同一段元数据的解析差异：

| schema | `date: 2026-09-20` 解析结果 |
|--------|------------------------------|
| `DEFAULT_SCHEMA`（`load()` 默认） | **`Date` 对象** → 序列化后为 `2026-09-20T00:00:00.000Z`（UTC，**存在时区位移**，东八区用户可能显示成前一天） |
| `CORE_SCHEMA`（YAML 1.2 core） | 字符串 `"2026-09-20"` ✅ |
| `JSON_SCHEMA` | 字符串 `"2026-09-20"` ✅ |

因此**固定使用 `jsyaml.load(raw, { schema: jsyaml.CORE_SCHEMA })`**。

另一个同类现象：`version: 1.10` 在三种 schema 下都解析为数字 `1.1`（YAML 数字语义，尾零丢失）。这属于 YAML 自身语义，不做修正，但需在验收时确认不会让作者困惑——必要时引导其改用 `codeBlock` 模式看原文。

#### 4. 渲染实现

插入到现有管线中，位置如下：

```
splitFrontMatter(源码) → marked.parse(body) → 前置元数据面板
  → DOMPurify.sanitize → applyAutoNumbering → preview.innerHTML
```

- 面板 HTML 由 `buildFrontMatterBlock(fm)` 生成，类名 `.fm-block` / `.fm-head` / `.fm-row` / `.fm-key` / `.fm-val` / `.fm-tag`；**具体样式一律内联输出**（`FM_PALETTE` 按主题取色、`FM_ICON_PATHS` 提供线条图标），`style.css` 只留过渡与窄屏降级
- DOMPurify 白名单无需改动：面板是 `sanitize()` **之后**才拼上去的自产标记，不经过消毒；同理 SVG 图标也不会被剥离
- 必须拼在 `applyAutoNumbering()` 之前，且面板内不使用 `<h*>`，确保不被编号

#### 5. 与既有功能的联动

| 受影响功能 | 处理 |
|---|---|
| 目录大纲 | `getSourceHeadings()` 跳过首部 front matter 区间，预览侧面板内无 `<h*>`（那个假 `<h2>` 自然消失） |
| 字数统计 | `updateCounts()` 统计 `body`（不含元数据），状态栏另标注「元数据 N 项（未计入）」 |
| 自动编号 | 元数据面板不参与，首行 H1 应从 1 开始而非被元数据顶掉 |
| 插入目录 | `generateTOC()` 只在正文区间插目录，保证元数据始终留在文件最顶部 |
| 复制到公众号 | 面板全是内联样式，随富文本一起复制即可；`copyToClipboard()` 会摘掉 `[data-fm-ui]` 标记的「属性 · n 项」标题行（属应用 UI，不是文章内容） |
| 导出 HTML / PDF / Word（F1） | **已落地**：元数据面板随导出内容一并带出——导出 HTML 保持面板原样（内联样式本就在），导出 **Word 时降级为两列表格**（`fmPanelToTable()`，Word 不认 flex）；导出 HTML / Word 的文件名优先取元数据 `title`。YAML 原文以 HTML 注释（`exportFrontMatterComment()`，app.js:1186）保留在导出文件里，便于二次编辑 |
| 打开本地文件 | 「打开」读入的文件常带 front matter，是本功能的主要触发路径；已有的覆盖确认逻辑不变 |

#### 6. 交互入口（实现时对规划做了一处调整）

规划建议把模式切换做成元数据块右上角的「⋯」小菜单（对齐 VS Code 在渲染出的 front matter 上提供右键菜单的做法）。实现时改成了**预览区工具栏左侧的一个下拉**（`#fmModeSelect`），原因有两个：

1. **隐藏档会把自己藏掉**——档位控件若长在元数据块上，切到「隐藏」后控件随块一起消失，用户再也切不回来
2. **控件不能进剪贴板**——元数据面板是会被复制到公众号的内容，挂在上面的按钮会被一并粘贴过去；工具栏在复制子树之外，天然干净

控件只在检测到元数据时露出（`updateFmModeControl()`），没有元数据的文档不会多出一排无用 UI；顶栏依然不加按钮。

### 风险与取舍

| 风险 | 说明 | 处理 |
|---|---|---|
| 误判正文 | 正文恰好以 `---` 分割线开头时不应被当成元数据 | 仅当「首行 `---`」+「至少一行 `key: value` 形态」+「闭合 `---`」三者同时成立才认定，否则按正文处理 |
| 渲染管线变复杂 | `renderMarkdown()` 是输入热点路径 | 正则剥离开销可忽略；YAML 解析只在检测到元数据时才执行 |
| 新增依赖 | 项目至今只有 5 个 CDN 依赖 | js-yaml 是唯一增量（39.4 KB），须在 README「技术栈」登记 |
| 主题适配成本 | 文章主题数 × 面板样式（F4 落地时 4 套，现 2 套） | `FM_PALETTE` 按主题查表取色（内含 `.fm-block` 所需的卡片 / 文字 / 图标 / 标签 / 代码块五组色），不做每套主题的 CSS 分叉——因为样式必须内联，走不了 CSS 变量 |

### 任务拆解

- [x] 复核现状：用项目锁定的 marked 4.3.0 离线复现（输出 `<hr>` + 吞掉全部元数据的 `<h2>`），再在 jsdom 中加载真实 `app.js` 复核集成行为
- [x] 登记依赖：`index.html` 引入 js-yaml 4.1.0 CDN，README「技术栈」补一行
- [x] 实现 `splitFrontMatter(src)`：正则剥离 + 容错（闭合 `---` 缺失 → 按正文；YAML 非法 → 剥离并回退源码形态）
- [x] YAML 解析固定 `jsyaml.load(raw, { schema: jsyaml.CORE_SCHEMA })`
- [x] 实现 `buildFrontMatterBlock(fm)`：Obsidian 风格「属性」面板 + 值类型化（数组 → 胶囊标签、布尔 → ✓/✗、日期、嵌套对象）+ 键的类型图标（`fmTypeOf()` / `FM_ICON_PATHS`）
- [x] `renderMarkdown()` 接入：剥离 → `marked.parse` → 前置元数据面板 → DOMPurify → 自动编号
- [x] `style.css` 补少量面板增强（`.fm-block` / `.fm-tag` 过渡、窄屏键列收窄）
- [x] 三档显示模式：预览工具栏下拉 + 写入 `mdtu-frontmatter`（**替代**原规划的表格内「⋯」菜单）＋ 旧档位值 `table → panel` 自动迁移
- [x] 大纲 / 字数统计 / 自动编号 三处适配（跳过元数据），并修掉「插入目录」会把目录插到元数据之上的问题
- [x] 元数据面板**直接输出内联样式**，不依赖 `getThemeStyles()`（**替代**原规划的「给 `getThemeStyles()` 补样式」），复制到公众号不会变成裸面板；复制时摘掉标题行
- [x] 嵌套对象 / 数组**递归展开**：`fmIsContainer()` 判定容器，`fmRenderNode()` 递归渲染，`fmLeafCount()` 统一计数口径（评审后追加，见「落地情况」第 4 条）
- [x] 顺手修复：`init()` 末尾的 `editor.focus()` 会把编辑器滚离顶部，同步滚动再按比例把预览一起带偏（实测 `editor.scrollTop=229` / `preview.scrollTop=92`）——改为加载完成后显式回顶
- [x] README 新增「文档元数据」小节与「特性」条目；DESIGN.md 同步

### 验收标准

1. 带 YAML front matter 的文件打开后，预览顶部出现「属性」面板，正文中不再出现 `<hr>` + 假 `<h2>`
2. 源码（textarea 内容）与「复制 Markdown」输出**完全未被改动**
3. `tags: [a, b]` 渲染为两个胶囊标签；`draft: false` 渲染为 `✗`；`date: 2026-09-20` 显示为 `2026-09-20` 而非 UTC 位移后的日期
4. 键前的类型图标与值类型一致（文本 / 列表 / 数字 / 复选框 / 日期 / 时间 / 标签）
5. 元数据不计入字数统计、不进入目录大纲、不参与自动编号；切换显示模式后统计数字不跳动
6. YAML 语法错误时不吞正文：块被剥离并以「源码」形态回显 + 就地提示；闭合 `---` 缺失时按普通正文处理
7. 三档模式（属性 / 源码 / 隐藏）切换即时生效，刷新后保持；旧存档值 `table` 自动迁移到 `panel`
8. 复制到公众号后面板与标签样式完整保留（依赖内联样式，**待真实公众号后台人工确认**）；UI 标题行不出现在复制结果里
9. 正文以 `---` 分割线开头的文档不被误判为元数据，且以 `---` 开头的普通文档不受影响
10. 嵌套对象 / 数组**逐层展开**：每个叶子属性独占一行，容器行显示直接子项数，数组元素用下标 `[0]` `[1]` 作行标，层级用缩进与竖线表达；标量数组（`tags`）仍保持一行胶囊；标题行与状态栏的计数口径一致，且都按叶子属性总数
11. 打开文档后**编辑器与预览都停在顶部**（不被 `focus()` 带偏）

### 落地情况

实现与上面的规划有 **4 处偏差**，均已在上方就地标注：

| 项 | 规划 | 落地 | 原因 |
|---|---|---|---|
| 展示形态 | GitHub 式两列键值表格（初版已按此实现） | **Obsidian 风格「属性」面板** | 用户评审初版后要求换风格——卡片 + 类型图标 + 定宽键列 + 标签胶囊，比表格线更轻，也更接近日常阅读 Obsidian 文档的习惯 |
| 嵌套值 | 折叠成一行 `key: value`（初版已按此实现） | **递归展开成缩进层级**，每个叶子属性独占一行 | 用户实际文档里 `doc:` / `assets:` 这类分组键把内容全挤在一行，只看得见两个分组名；改为摊开渲染，容器行显示直接子项数、数组用下标作行标。交互模型参照 Obsidian 社区插件 `nested-properties`（Obsidian 原生 Properties 面板本身不支持嵌套，同样靠插件补） |
| 模式切换入口 | 元数据块右上角「⋯」菜单 | 预览区工具栏左侧下拉 | 「隐藏」档会让控件随块一起消失，用户无法切回；且按钮会被复制进公众号 |
| 复制时的样式来源 | 给 `getThemeStyles()` 补样式规则 | 元数据面板直接输出内联 style | 公众号会剥离 `<style>`，内联样式才可靠；顺带避免了与既有 `<style>` 注入路径耦合 |

> **为什么没有直接引入现成的开源查看器**：Obsidian 的 `nested-properties` / `nested-frontmatter-properties` 都依赖 Obsidian 内部 API（`metadataTypeManager.registeredTypeWidgets`），无法用于独立网页；Front Matter CMS 是 VS Code 扩展工程；通用 JSON 树查看器（JsonTree.js、`@vdonec/json-view`、tree.json 等）虽是 CDN 可引入的 UMD，但定位是「代码调试器」观感，且**输出的是 class 样式**——与「必须内联样式才能在公众号存活」这条硬约束冲突，也不认 YAML 的语义类型（`tags` 胶囊、日期、复选框）。因此只借用其交互模型，渲染仍自己实现（零新增依赖，约 30 行递归）。

**实测记录**：两轮离线验证共 182 条断言全部通过，均已随代码跑通真实解析链路（非复制的实现）。第二轮覆盖换风格后的面板结构、类型图标、旧档位迁移与复制路径；第三轮补嵌套展开与层级竖线。

| 轮次 | 手段 | 覆盖 | 结果 |
|------|------|------|------|
| 单元 | 抽取 `app.js` 中真实的 Front Matter 段落，配合真实 js-yaml 执行 | 剥离 / 解析 / 面板与标签输出 / 类型图标与类型推断 / 三档模式 / 旧档位迁移 / 边界（BOM+CRLF、块状数组、嵌套对象、无闭合、YAML 非法、`---` 开头正文、XSS 转义含键名）/ 主题取色 / 全文可无损还原 / **容器判定与叶子计数** | 96 / 96 |
| 集成 | jsdom 加载真实 `index.html` + 真实 `app.js`，并按浏览器 UMD 形态注入 marked 4.3.0 / DOMPurify / js-yaml | 假标题消失、面板结构与 tags 标签、类型图标进 DOM、源码未改动、字数与行数排除元数据、自动编号不污染、大纲不含元数据且行号偏移正确、三档模式与持久化、换主题换色、插入目录保持元数据在顶部、复制路径摘掉 UI 标题行且内联样式随复制带出、无元数据文档行为不变、**嵌套逐行展开与层级竖线随复制带出** | 86 / 86 |

观感另用真实浏览器（本机 Edge headless）截图核对——jsdom 只能验结构，验不了"好不好看"。

验证脚本放在工作空间的 `.workbuddy/tools/`（`fm-unit.js` / `fm-e2e.js` / `fm-shot.js` / `fm-dump.js` / `bq-*.js`，以及 F1 新增的 `ex-test.js`），不进仓库。跑法：`cd .workbuddy/tools && npm i`，再逐个 `node` 执行。

实现中修掉的缺陷（均为测试直接暴露）：

1. **块状数组识别不到**——`FM_KV_RE` 原先要求冒号后必须有非空白字符，导致 `tags:` 换行再跟 `- 甲` 这种写法整块不剥离，元数据又退化成 `<hr>` + 假标题。放宽为 `(\S|$)` 后修复
2. **正文区间多一个空行**——剥离后 `body` 以闭合 `---` 后的空行开头，字数 / 行数各多 1。改为剥掉正文区间开头的空行（不影响渲染，且 `head + body` 仍与源码逐字符相同）
3. **复制断言取错样本**（测试侧）——复制内容挂在 `body` 末尾的临时容器里，最初用 `body.innerHTML` 取样会把页面上的原始预览一并取进来，导致「标题行已摘除」误报失败。改为取 `body.lastElementChild` 后通过

---

## F5 · 文件夹模式（打开整个文件夹并写回磁盘）

> **状态：🟦 F5-a 已实现**（2026-10-13 落地、2026-10-14 修订，2026-10-20 经 PR #2 并入 `main`，开发分支已删除）；F5-b / F5-c / F5-d 待做。完整技术方案、交互设计、数据模型与边界清单见 **[F5-FOLDER-MODE.md](./F5-FOLDER-MODE.md)**；本节只记录登记信息与关键结论，避免两处各写一份。落地时新增回归套件 `fs-test.js`（初版 104 条 → 结构修订后 155 条 → 观感与产物修订后 **199 条**）。

### 背景

用户诉求（2026-10-13）：**「增加直接打开整个文件夹，并实时在线编辑的功能」**——把工具从「单篇排版器」扩展为「本地 Markdown 工作区」：一次看到整个 vault 的目录结构、自由切换文档、并把编辑结果写回磁盘。

这条诉求同时命中 README「已知限制」的第 1 条（无导出）与第 2 条（「打开」是只读的）。**F5 是第一个让内容真正离开浏览器的功能**，因此也是迄今风险最高的一项——写回是真正的磁盘覆盖，FSA 没有事务、没有回滚，写错即丢失。

### 现状：单文档假设清单（已逐项核实代码）

| # | 假设点 | 代码位置 | 现状 |
|---|--------|----------|------|
| 1 | 正文只有一份 | `saveContent()` / `loadContent()`（app.js:2201 / 2205） | 固定读写 `localStorage['mdtu-content']` 这一个键 |
| 2 | 输入即全量落库 | `editor.addEventListener('input')` → `saveContent()`（app.js:1548） | 没有「当前文档」概念，也没有脏标记 |
| 3 | `Ctrl+S` 只写 localStorage | app.js:2078 | 项目至今**没有任何写回磁盘的能力** |
| 4 | 打开文件即覆盖 | app.js:1680–1702 | 读入后直接赋给 `editor.value`；`file.name` 只在 Toast 里出现一次，不保存 |
| 5 | 编码固定 UTF-8 | `reader.readAsText(file, 'utf-8')`（app.js:1700） | 单文档模式下 GBK 文件已经会乱码 |

反过来，**渲染层完全不必改**：`renderMarkdown()`（app.js:547）是 `editor.value` 的**纯函数**，不关心「当前是哪个文件」。切换文档本质上就是「换 `editor.value` → 调一次 `renderMarkdown()`」。这是本项最大的有利条件——全部文章主题、Front Matter 面板、水印、外链转脚注、大纲零改动。

### 能力实测（2026-10-13，Edge 155.0.4283.45 本机真实浏览器）

判定「能不能做」的唯一硬问题是 **`file://` 下 File System Access API 是否可用**——它决定 README 的「方式二：直接双击打开」要不要废弃。三组对照实测：

| 场景 | origin | `isSecureContext` | `typeof showDirectoryPicker` | 实际调用结果 |
|------|--------|-------------------|------------------------------|--------------|
| A | `file://` | **true** | `function` | `SecurityError: Must be handling a user gesture to show a file picker.` |
| B | `http://127.0.0.1:20075` | true | `function` | 同上（缺用户手势） |
| C（对照组） | `http://192.168.5.197:20075`（局域网 IP） | **false** | **undefined** | `TypeError: window.showDirectoryPicker is not a function` |

**结论：**

1. 该 API 由 `[SecureContext]` 门控——场景 C 里**连函数都不存在**，说明拦截发生在「函数暴露」之前。
2. 因此场景 A 的 `SecurityError` **不可能**来自安全上下文检查，只能是缺用户手势（headless 造不出真实手势）。
3. 即 **`file://` 满足安全上下文要求，API 可用**（`file://` 属于 spec 定义的 potentially trustworthy origin）。README 的「双击打开」路径**无需废弃**。
4. **残留不确定性**：headless 造不出真实点击手势，理论上仍可能存在 Chromium 层面的额外限制。F5-a 的第一个动作就是用真浏览器手动点一次确认——5 秒钟的事，但必须在写代码之前做掉。

顺带实测到的两件事：

- **修正一条旧表述（F1 已落地并复核）**：F1 原本写「`file://` 下 Clipboard API 不可用」，本次实测 `file://` 是安全上下文，`navigator.clipboard.writeText` 存在（场景 A 为 `function`，场景 C 才是 `undefined`）。F1 落地时按「先试 Clipboard API、失败再降级」实现——`execCommand('copy')` 降级路径仍保留，因为写操作还需 transient activation 与文档聚焦，且这条路径同时兜住「非安全上下文」与「浏览器拒绝授权」两种情况。
- **可选能力**：`FileSystemObserver` 在 Edge 155 已为 `function`（`file://` 与 localhost 下均可用），可作为 F5-d「外部修改检测」的原生方案候选，替代轮询。另 `navigator.storage.getDirectory()`（OPFS）亦可用。

### 技术方案（选型摘要）

| 路径 | API | 能力 | 兼容面 |
|------|-----|------|--------|
| **主路径** | File System Access API（`showDirectoryPicker`） | 枚举 + 读 + 写 + 新建 + 删除 | 仅 Chromium 系（Chrome / Edge） |
| 只读降级 | `<input type="file" webkitdirectory>` | 仅枚举与读取 | 全浏览器（实测**非安全上下文下也可用**） |
| 兜底 | 现有单文档模式 | 维持现状 | 全浏览器 |

不引入任何新依赖、不引入构建步骤（「共同前置约束」的例外，见总览后的说明）。

**推荐分期：**

| 阶段 | 内容 | 依赖 | 风险 | 状态 |
|------|------|------|------|------|
| **F5-a** | 打开文件夹（**只读**）：文件树 + 切换文档 + 复用现有渲染 | 无 | 零（不碰磁盘） | ✅ 已完成 |
| F5-b | 写回：`Ctrl+S` 存盘 + 脏标记 + 重新授权 + `.bak` 保护 | 无 | **最高**（覆盖磁盘） | ⬜ 待做 |
| F5-c | 文件管理：新建 / 重命名 / 删除 + 忽略规则 + 懒加载 | F5-a | 中 | ⬜ 待做 |
| F5-d | 外部修改检测 + 冲突提示 | F5-b | 中 | ⬜ 待做 |

先做 F5-a 的理由：交付快、风险为零，且能立刻验证「文件夹模式是不是真的会一直用」。F5-b 虽然才叫「实时编辑」，风险却最高，应在文件树与切换都稳定之后再叠加。

### 边界

F5 **不越界**：纯本地、不碰后端，与「非目标」中的「云同步」无关。但**版本历史明确不做**——那件事交给 git；若在文件夹模式里顺手做滚动快照式历史，就越线了（详见设计文档的边界一节）。

### 任务拆解

- [x] **前置验证**：真浏览器手动点一次 `showDirectoryPicker()`，确认 `file://` 下能弹出目录选择器（2026-10-13 确认可用）
- [x] **F5-a** 能力探测与降级：不支持时保持现有单文档模式，UI 不露出入口
- [x] **F5-a** 文件树 UI（落点复用现有浮层，`#outlinePanel` 见 app.js:1828 / 1971）
- [x] **F5-a** 目录递归枚举：忽略 `node_modules` / `.git` / `dist`，子目录懒加载
- [x] **F5-a** 文档切换：换 `editor.value` → `renderMarkdown()`
- [x] **F5-a 修订**「文件 / 文件夹」收进顶栏「打开」下拉（不再各占一个按钮），避免顶栏继续横向膨胀
- [x] **F5-a 修订** 文件树抽屉的显示 / 隐藏：菜单项开关 + 头部「收起」按钮 + **收起后可拖动的悬浮球**
- [x] **F5-a 修订** 树本身的「全部展开 / 全部收起」（展开逐个读盘，`TREE_EXPAND_MAX = 400` 封顶）
- [x] **F5-a 修订** 打开文件 / 切换文档成功**不弹 Toast**（编码例外：非 UTF-8 / UTF-16 只读预览时必须提示）
- [x] **F5-a 修订** 全屏预览**锁定当前设备档**（设备档整组隐藏；页宽仅在 PC 档出现）
- [x] **F5-a 修订** 抽屉入口改为**可拖动的悬浮球**（44×44、**实心蓝底 + 白图标、按下变橙**、投影、位置持久化 + 视口钳制）；头部去标题行、操作挂名字行尾、全树字号统一 **14px**（字号 / 图标同步放大）
- [x] **F5-a 修订** 文件树只列 Markdown（枚举层过滤），**没有文档的目录连文件夹都不显示**（`hasMarkdownDeep()` 探测 + 快照模式 `prune()`），打开时只提示一句「仅显示 Markdown 文档」
- [x] **F5-a 修订** 头部「收起」图标由 `×` 改为「面板 + 左向箭头」（叉号会被读成关闭 / 删除）
- [x] **F5-a 修订** 「打开」与「导出」两个下拉收缩到内容宽（去掉 `min-width: 216px` 与 `.export-ext` 的 `margin-left: auto`）
- [ ] **F5-b** 拆出「按文档存取」的持久化层，替代固定的 `mdtu-content`
- [ ] **F5-b** `Ctrl+S` 写回磁盘 + 脏标记 + 首次接管某文件时先写 `.bak`
- [ ] **F5-b** 换行符（CRLF / LF）原样保留 + 编码嗅探的**写回侧**（读侧判据已在 F5-a 落地：非 UTF-8 一律关闭写回通道）
- [ ] **F5-c** 新建 / 重命名 / 删除 + 危险操作二次确认
- [ ] **F5-d** 外部修改检测（窗口重新聚焦 + 切换文件两个时机，或 `FileSystemObserver`）+ 冲突二选一提示
- [x] 同步更新 README / DESIGN / 本文件，并修订「已知限制」第 2 条

> **与规划的一处偏差**：规划里「文档切换含未保存内容确认」在 F5-a 未实现——本期不写盘，切换不会丢失任何已存盘内容（编辑内容仍在 localStorage 里），因此不加确认弹窗，避免每次点文件都被拦一次。这条确认应在 F5-b（真正会丢改动）时随脏标记一起做。

### 验收标准

1. `file://` 与 `localhost` 两种打开方式下「打开文件夹」均可用（真浏览器手动确认）
2. 打开含 500+ 文件的目录不卡顿（懒加载 + 忽略规则生效）
3. 切换文档后预览、大纲、字数统计、元数据面板全部跟随切换，且**渲染层代码零改动**
4. `Ctrl+S` 写回磁盘后，用外部编辑器打开该文件内容一致，**换行符与原文相同**
5. 非 UTF-8（GBK）文件只读打开并给出提示，**绝不被写回覆盖**
6. 磁盘被外部修改后再切回该文档，给出「重新载入 / 保留我的版本」提示
7. 不支持该 API 的浏览器（Firefox / Safari）保持现有单文档模式，功能不退化
8. 刷新页面后「最近打开的文件夹」入口可用，重新授权后回到原文档

### 落地记录（F5-a，2026-10-13）

落地文件：`index.html`（顶栏 `#btnOpenFolder` 入口 + 只读降级用的 `#folderInput` + 左侧抽屉 `#fileTreePanel`）、`css/style.css`（`/* ===== F5：文件树抽屉 =====` 段）、`js/app.js`（末尾 `// ===== F5：文件夹模式（只读）=====` 段）。**零新增依赖**——只用浏览器原生 API 与 DOM，没有引入任何树组件库。

| 规划项 | 实际做法 |
|--------|----------|
| 三层能力降级 | ① `showDirectoryPicker` 存在 → 完整模式；② `'webkitdirectory' in input` → **只读快照模式**（`<input webkitdirectory>` 的扁平列表按 `webkitRelativePath` 补成树，节点上挂 `File` 对象）；③ 都没有 → 入口与抽屉**从 DOM 摘掉** |
| 文件树落点 | 抽屉刻意复用 `.outline-panel` 类做骨架（`display:none` / `.show` / **打印时隐藏**三件事白拿），`.file-tree-panel` 只覆盖成「左侧通栏抽屉 + 毛玻璃 + 宽度可拖」（宽度记 `mdtu-tree-width`） |
| 懒加载 | 只把「已展开」的目录铺开；但为了剪掉空壳目录，枚举时会向下探一层——`hasMarkdownDeep()` 见到第一个 `.md` 就返回，`TREE_PROBE_MAX` 封顶（预算用尽一律判「有」，不错杀）。忽略清单 `node_modules` / `.git` / `dist` / `build` / `out` / `.next` / `.venv` / `__pycache__` / `.DS_Store`，命中即整棵剪掉；排序 = 目录在前 + `localeCompare(zh, { numeric: true })`；单目录读失败只局部标红 |
| 文档切换 | 换 `editor.value` + `renderMarkdown()`，随后回顶 + `suppressSync()` + `saveContent()`（沿用单文档存档，刷新仍停在这篇）。**渲染层零改动** |
| 编码 | 读侧判据提前到本期：BOM → 严格 UTF-8（`fatal: true`）→ 失败即判非 UTF-8 并回退 `TextDecoder('gbk')` 只读预览。这条同时是 F5-b 关闭写回通道的依据 |
| 非 Markdown 文件 | **不进树**（枚举层过滤，白名单 `.md` / `.markdown` / `.mdx`）；**整棵没有 Markdown 的目录连文件夹都不显示**（探测 + 剪枝），打开工作区只提示一句「仅显示 Markdown 文档」 |

**顺带修掉一条既有回归（顶栏溢出）**：实测 1280px 下顶栏 `scrollWidth 1395 / clientWidth 1248`——F5 之前 `#btnExport` / `#btnCopy` 就已经在可视区外了，新增入口后又把「外链转脚注」挤了出去。改为「中间那组可横向滚动、右侧主操作永不缺席」（详见 DESIGN §5.1）。

**验证**：新增回归套件 `.workbuddy/tools/fs-test.js`（**104 条**：静态源码断言 + jsdom 端到端 + 真实 Edge 几何/观感，含「代码里不得出现任何写盘 API」这条只读硬约束）。连同既有四套（95 + 87 + 58 + 225），**合计 569 条断言全绿**。

**仍需人工确认的一项**：README「方式二：直接双击打开」下、**真实文件系统**里的目录选择器弹出——headless 造不出真实点击手势，本期的 C 段用打桩的假文件系统验证了逻辑与几何，但「`file://` 下真能弹出来」这一步是用户于 2026-10-13 手动确认的（见 §9.4）。

### 落地记录（F5-a 修订，2026-10-14）

第一版 F5-a 把「文件夹」直接摆在顶栏上，于是顶栏净增一个按钮、把「外链转脚注」挤了出去。这一轮做了五处调整：

| # | 调整 | 做法 |
|---|------|------|
| 1 | **「文件 / 文件夹」收进「打开」下拉** | 与「导出」下拉共用 `.export-wrap` / `.export-menu` / `.export-item` 骨架，只补 `#openWrap.single .export-caret`（不支持文件夹 API 时菜单只剩一项，收掉箭头）。顶栏按钮数回到 F5 之前的水平 |
| 2 | **打开成功不弹 Toast** | 单文件打开与树里切换文档都不弹——正文已经换掉了，浮层只是碍事。**唯一例外**是编码：非 UTF-8（GBK 回退）/ UTF-16 只读预览时必须提示，因为那不是原文件字节的忠实还原 |
| 3 | **抽屉的显示 / 隐藏** | 三条路：菜单项开关（带 `.active` 激活态）、头部「收起」按钮、**收起后的悬浮球 `.tree-peek`**（`position: fixed`，只在「有工作区 + 已收起」时出现） |
| 4 | **树的「全部展开 / 全部收起」** | 收起 = 清空展开集合（`children` 留着，不必重读盘）；展开 = 逐个目录读盘，`TREE_EXPAND_MAX = 400` 封顶，到顶提示「只展开了前 400 个」，每 20 个重绘一次 |
| 5 | **全屏锁定当前设备档** | `enterFullscreen()` 把 `#previewModeGroup` 整组隐藏，页宽组只在 PC 档显示（iPad / APP 的版心是 `--dev-max`，inline `max-width` 会压掉它），非 PC 档进入时清掉遗留的 inline `max-width` 与 `page-mode` |

**验证（修订后）**：`fs-test.js` 扩到 **155 条**（静态 34 / jsdom 43 / 真实 Edge 78），连同既有四套（95 + 87 + 58 + 225），**合计 620 条断言全绿**。新增覆盖：顶栏按钮全部在可视区内且互不重叠、菜单只一项时收箭头、抽屉的开关 / 把手 / 全部展开收起、全屏时设备档隐藏且正文仍按当前档渲染、打开文件不弹 Toast。

### 落地记录（F5-a 观感与产物修订，2026-10-14 晚）

一轮「用起来哪里别扭」的修补，五条全部来自用户当轮反馈（明细与取舍见 [F5-FOLDER-MODE.md §11.6](./F5-FOLDER-MODE.md)）：

| # | 调整 | 做法 |
|---|------|------|
| 1 | **抽屉把手太不明显** | `.tree-peek` 重写：18×42、`top:50%` + `translateY(-50%)` 垂直居中、只留右半圆角、主题色底与字色，悬停加深加宽 ※**下一轮已改为可拖动的悬浮球** |
| 2 | **只展示 MD，并报「已过滤」** | 过滤下沉到枚举层（`isMdName()` 不过关就 `filtered++` 且不入队，快照模式同理由 `buildSnapshotTree()` 处理）；目录行首出「已过滤 N 个非 Markdown 文件」，无 MD 时补「（无 Markdown 文档）」 ※**下一轮已改为「不报数 + 空目录整条不显示」** |
| 3 | **去掉「文件树」标题行，操作挂名字行尾，字号统一** | 头部只剩 `.tree-head`（工作区名 + 四个 `.tree-btn`）；全树字号统一 13px（原来提示行是 12px） ※**下一轮已提到 14px，图标同步放大** |
| 4 | **两个下拉太宽、中间留白** | `.export-menu` 改 `width: max-content`（去掉 216px 下限），`.export-item .export-ext` **去掉 `margin-left: auto`**——中缝的真正成因；实测两个下拉 172–174px |
| 5 | **「导出 PDF」与「打印」拆开** | 「导出 PDF」改走 `exportPdfFile()`（离屏渲染 → A4 切片 → JPEG → `jsPDF` → **直接下载**）；另立「打印」走原 `printDocument()`。两个库首次点击才懒加载，`index.html` 常量依赖计数不变 |

**验证（本轮）**：`fs-test.js` 扩到 **199 条**（静态 74 / jsdom 67 / 真实 Edge 58），`ex-test.js` 扩到 **262 条**（新增 C4 真实浏览器 PDF 产物段），连同 `fm-unit` 95 + `fm-e2e` 87 + `bq-test` 58，**合计 701 条断言全绿**。新增覆盖：把手几何 / 圆角 / 配色 / 垂直居中、四类行字号相等、真实浏览器里的「已过滤」提示与 `.txt` 不在树中、两个下拉宽度与后缀间隙、导出菜单五个动作。

> **测试脚本本身也修了一处锚点**：`ex-test.js` 原先用 `indexOf('/* ===== Print / 导出 PDF =====')` 定位打印段。本轮把这段注释标题改成「Print / 打印」（因为「导出 PDF」已拆成独立链路）后，锚点失效 → 8 条打印断言集体假失败。现改为锚在 `@page {` 上（全文唯一、不随文案变动），并另加一条「打印段有注释标题」的断言兜底。

### 落地记录（F5-a 第三轮：空目录剪枝 / 悬浮球，2026-10-14 晚）

又一轮来自用户反馈的修补，三条：

| # | 调整 | 做法 |
|---|------|------|
| 1 | **过滤不再报数，空目录干脆不显示** | `filtered` 计数与 `filteredNoteText()` 整条删除（节点模型、渲染、Toast 一起清）。改为**剪枝**：完整模式在 `loadChildren()` 里对每个子目录调 `hasMarkdownDeep()`——见到第一个 `.md` 立刻返回，累计条目数到 `TREE_PROBE_MAX = 1500` 就一律判「有」；快照模式手里有全量列表，建完树跑一遍自下而上的 `prune()`。打开工作区只提示「仅显示 Markdown 文档」 |
| 2 | **头部的 `×` 有歧义** | 换成「面板 + 左向箭头」：`×` 在这个位置会被读成「关闭 / 删除」，而它做的只是把抽屉折回边缘 |
| 3 | **把手改成可拖动的悬浮球** | `.tree-peek` 从「贴左缘、18×42、只有右半圆角」改为 **44×44 正圆 + 投影**；指针事件拖动（`setPointerCapture`），**位移 < `PEEK_DRAG_SLOP`（4px）才算一次点击**——拖完不会顺手把抽屉弹开；位置存 `mdtu-tree-peek-pos`，`resize` 时重新钳回视口 |

**验证（本轮）**：`fs-test.js` 扩到 **222 条**（静态 89 / jsdom 70 / 真实 Edge 63），连同既有四套（`fm-unit` 95 + `fm-e2e` 87 + `bq-test` 58 + `ex-test` 262），**合计 724 条断言全绿**（※第四轮为 740 条）。新增覆盖：`assets` 这种「整棵没有 Markdown」的目录不在树里、`hasMarkdownDeep()` 的早退（`notes` 探到 `x.md` 就不再往下读 `sub`）、探测预算存在、悬浮球的 44×44 正圆 / 投影 / 拖动改写位置 / 拖后不弹抽屉 / 位置落库、`×` 图标确已换掉。

> **一个被有意接受的代价**：为了让「空壳目录」在点开之前就消失，枚举时**必须**向下读一层。所以「未展开的子目录一次都不枚举」这条性质不再成立——现在是「未展开的子目录只被**探**一层、内容不进 DOM」，测试里的 `__listed` 计数也据此改写。为了不让这件事失控，探测带早退与预算双保险：常规文档目录只读几个条目，预算用尽则退回旧行为（保守保留）。

### 落地记录（F5-a 第四轮：字号图标放大 / 悬浮球配色，2026-10-14 晚）

两条用户反馈（明细与取舍见 [F5-FOLDER-MODE.md §11.8](./F5-FOLDER-MODE.md)）：

| # | 调整 | 做法 |
|---|------|------|
| 1 | **「文件树面板的字体、图标都调大一些，看起来好小」** | 全树文字 13px → **14px**（七处一起改、仍保证同号）；图标 `ICON_CARET` 12 / `ICON_DIR` 15 / `ICON_FILE` 14；头部四个 `.tree-btn` 24×24 → **28×28**、内联 SVG 16×16；折叠箭头槽 14、图标槽 16、缩进步长 `depth * 15`、行内边距 5/12 |
| 2 | **「悬浮球背景色直接改成蓝色，点击时动态切换到橙色」** | `.tree-peek` 由浅底 `--accent-light` 改为**实心 `--accent` 蓝 + 白图标**；`:root` 新增 `--accent-press: #f97316`，按下挂 `.pressing` 切橙。**不用 `:active`**——`pointerdown` 里 `preventDefault()` 之后 `:active` 未必成立，JS 显式管 class 才可控可测。位移过 `PEEK_DRAG_SLOP` 即摘掉 `.pressing`，于是「点击 = 橙、拖动 = 蓝」可分辨 |

**验证（本轮）**：`fs-test.js` 扩到 **238 条**（静态 97 / jsdom 73 / 真实 Edge 68），连同既有四套（`fm-unit` 95 + `fm-e2e` 87 + `bq-test` 58 + `ex-test` 262），**合计 740 条断言全绿**。真实 Edge 段用真 `PointerEvent` 验「按下 → 橙 `rgb(249,115,22)`、开始拖动 → 蓝 `rgb(59,130,246)`」。截图由一张扩到两张：`fs-tree.png`（放大的树）+ `fs-peek.png`（实心蓝悬浮球）。

> **踩坑（同名遮蔽）**：探针脚本里已有 `var peek = document.getElementById('treePeek')`，新加的摆拍开关若也取名 `peek`，会被它遮蔽 → 两张截图**都走「球」分支**，PNG 的 MD5 一模一样、`fs-tree.png` 其实没拍到树。改用 `window.__peek`。**这种遮蔽不报错，只静默给错结果**——所以现在会比对两张图的 MD5。

### 落地记录（第五轮：下拉互斥 / 去后缀 / 目录只插一次 / 复制标识，2026-10-20）

四条用户反馈，都是「用起来多余或容易撞车」的细节：

| # | 调整 | 做法 |
|---|------|------|
| 1 | **两个下拉不能同时展开** | 「打开」「导出」各自只负责自己的开合，而两个触发按钮都 `stopPropagation`（否则会被自己的「点外部关闭」立刻收掉）→ 点另一个时前一个收不到事件，两个菜单会同时摊在屏幕上。补一层**捕获阶段**的门（追加在 `app.js` 末尾的独立 IIFE）：按下任一触发按钮先把另一个收起，只维护既有的 `show` / `open` / `aria-expanded` 三个状态 |
| 2 | **下拉项不再显示文件后缀** | 删掉 `.export-ext` 里重复标签本身的 `.md` / `.html` / `.pdf` / `.doc`（「导出 HTML」后面再跟一个 `.html` 只是重复）。**保留** `源码` / `工作区` / `Ctrl+P`——那三处是补充信息（产物形态、入口含义、快捷键），不是后缀 |
| 3 | **「插入目录」只插一次** | 原实现是「有则整段替换」，重复点会**改写已有那一份**（位置也留在原地）。改为 `tocRegex` 命中即 `showToast('已存在目录，无需重复插入')` 后 `return`，源码一个字符都不动（**第六轮已彻底改为「派生目录」，见下**） |
| 4 | **「复制」加微信标识** | 复制产物（内联样式富文本）唯一落点是公众号编辑器，按钮上挂一枚内联 SVG 的双气泡微信标识；`.btn-wechat` 只给 `flex: 0 0 auto` + 轻微降调，不加底色也不加文字，不撑宽顶栏 |

**验证（本轮）**：`ex-test.js` 322 条（新增 6 条静态「无后缀 / 有微信标识」+ 10 条 jsdom 与 6 条真实 Edge 的互斥断言）、`fs-test.js` 238、`fm-e2e.js` **89**（新增「重复点插入目录不改源码 + 提示已存在」两条）、`fm-unit` 95、`bq-test` 58，**合计 802 条断言全绿**。互斥特意在 jsdom 与真实 Edge 两处都量：前者证明状态机，后者证明 `display` 真的为 `none`（jsdom 不做布局）。

> **顺带维护**：`index.html` 净 -1 行、`style.css` +10 行（尾部新增 `.btn-wechat`，不挪动任何既有规则）、`app.js` +39 行（尾部新增互斥 IIFE）。前者让两处 `index.html:NNN` 引用各前移 1 行，已同步 DESIGN / ROADMAP，并用 `cite-check.js` 复核落点。

### 落地记录（第六轮：目录改为「派生目录」，2026-10-20）

这一轮是一次**返工**，起因是用户一句「为什么更新了文档内容，目录不会自动刷新」：

- 第五轮把目录做成「只插一次」，第六轮先做成「插入 / 更新」两态——**两版都把目录当成源码的一部分**，所以刷新只能靠手点。
- 真正的问题在形态：目录是标题的**函数**，它不该被冻结进文档。于是改成**派生**——源码只留一行 `<!-- TOC -->` 标记，列表在渲染时生成。

| # | 调整 | 做法 |
|---|------|------|
| 1 | **源码只留标记** | 点「插入目录」写入一行 `<!-- TOC -->`（在元数据块之后），**不再写列表、不再写结束标记**。标题一改，预览目录立刻跟上 |
| 2 | **两段式渲染，锚点用真实 id** | 解析前 `withTocSlot()` 把标记换成 `<div data-toc-slot>`（marked 原样透传 → DOMPurify 保留 `data-*`）；`preview.innerHTML = html; fillTocSlot();` 之后再按 DOM 里真实标题补出 `<ul class="toc">`。**不自己拼 slug**——标点与重复标题的序号都会和 marked 错位成死链 |
| 3 | **层级用栈** | `stack = [{level, ul}]`：变浅就弹栈、变深就挂到上一个 `li` 里，`h1 → h3` 的跳跃也接得住；无标题时不留空壳 |
| 4 | **按钮三态** | `insert`（插入目录）/ `remove`（移除目录，不再需要「更新」）/ `legacy`（带 `<!-- /TOC -->` 的旧整块 → 「转为自动目录」，点一次收成标记）。同步路径仍是 `input` + 按钮 click + `MutationObserver(#preview)`，状态在 `data-toc` |
| 5 | **代码块里的标记不算** | `withTocSlot()` 逐行扫围栏，``` / ~~~ 内的 `<!-- TOC -->` 是示例文本，原样保留——否则讲解本功能的文档会被自己改写 |

> **代价（写进 README 了）**：`.md` 原文和 GitHub 预览里看不到目录列表，只有一行注释。目录属渲染层产物，预览 / 复制公众号 / 导出 HTML / PDF / Word 都带。
>
> **取舍回顾**：也考虑过「打字停手 400ms 后回写源码」和「保存 / 导出时回写」两种力度。前者会打断 textarea 原生撤销栈、git diff 持续抖动；后者输出永不过期但预览里仍是旧目录。派生方案是唯一「既不碰源码、又永远不过期」的解法。

**验证（本轮）**：`fm-e2e.js` 89 → **112 条**（新增 23 条：源码只留一行标记 / 不写结束标记 / 列表不进源码、预览条目数与标题数一致、每个锚点都等于对应标题的真实 `id`、多级嵌套、按钮 `insert → remove` 文案、改标题后源码不回写而预览自动更新、新增 h3 后条目数为 3 且顺序正确、再点即移除、旧整块 `legacy` 迁移成一行标记、围栏代码块里的标记不生成目录）。其余四套不变：`fm-unit` 95、`bq-test` 58、`ex-test` 322、`fs-test` 238，**合计 825 条断言全绿**。真实 Edge 摆拍图 `shots/toc-github.png` 复核了嵌套层级与「移除目录」按钮文案。

---

## F6 · 预览模式（设备档）

> **状态：✅ 已实现**（2026-10-13）。落地文件：`index.html`（预览工具栏的 `#deviceGroup` 一组平铺档位按钮，`index.html:264–270`）、`css/style.css`（`/* ===== Preview Mode: 设备端 =====` 段，style.css:527 起；按钮组样式在 `.seg-btn` 1351 / `.seg-group` 1381 处）、`js/app.js`（`// ===== Preview Mode: 设备端 =====` 段，app.js:872 起）。**零新增依赖**（档位就是原生 `<button>`，没有引入任何 UI 库）。
>
> 落地后的设计说明已并入 [DESIGN §7.9 预览模式](./DESIGN.md)；本章保留规划背景、交互取舍与实测记录。

### 背景

本项目的产出主要投给**公众号**，而公众号的正文环境与桌面上看到的差别不小：

| | 公众号 | 桌面 Web |
|---|---|---|
| 正文版心 | 约 677px | 主题原貌（本项目 820px） |
| 正文字号 / 行高 | 17px / 1.75（含 `letter-spacing: .5px`） | 16px / 1.6 |
| 代码块 | **不支持横向滚动**，长行被硬折断 | 可横向滚动 |
| 公式 / 图表 | 不渲染（需图片化） | 正常渲染 |
| 外链 | 不可点 | 可点 |

而写稿时又总要在**不同屏幕尺寸**下看一眼（PC 上看排版、平板上是否够读、手机上是否溢出）。此前只能靠调窗口大小猜。

### 交互设计

预览工具栏左侧是一组设备档（**全部平铺、点一下就切**，不用下拉）：

| 档位 | 设备视口 | 排版基调 |
|------|---------|---------|
| `PC`（默认） | 不限宽，上限 820px | Web —— 主题原貌 |
| `iPad` | 768px | Web + 平板适配（正文 17px / 行高 1.7 / 内边距加宽） |
| `APP` | 375px | **公众号**（正文 17px / 行高 1.75 / 字距 +0.5px / 长代码行硬折行） |

两点取舍：

- **平铺而非下拉**：只有三档，全部显示出来最省事——不用展开、一眼看到选了哪档，点一下就切。样式复用已有的「页宽」按钮盒子（`.seg-btn` 与 `.width-btn` 共用同一份规则），没有引入新的视觉语言。
- **平台规则内建在设备档里，不再单列一个维度**：最初按需求做成了「设备端 × 展示端（Web / 公众号 / 掘金）」两个正交维度；实测后确认**每档设备其实只对应一种典型阅读场景**，自由组合反而会造出「PC × 公众号」这类现实中不存在的组合，于是**合并为一维**——PC 按 Web、iPad 按 Web + 平板适配、APP 按公众号。旧存档键 `mdtu-platform` 由 `init()` 主动清掉。

**切换不弹提示**：档位文字自明、按钮高亮即选中态，切完正文立刻变——浮层会挡住正文并停留 2.5s，对「反复切着看」的场景是反效果（初版按规划做过 Toast，实测后去掉）。工具栏上同样不写「设备」二字，三档直接平铺。

### 技术方案

1. **版心 = 设备视口压一道 820px 上限**：
   ```css
   .markdown-body { max-width: min(var(--dev-max, 820px), 820px); }
   .markdown-body.device-ipad { --dev-max: 768px; }
   .markdown-body.device-app  { --dev-max: 375px; }
   ```
   PC 档不设 `--dev-max`，回落到 820px，与改造前一致。
2. **选择器写成 `.markdown-body.xxx`（两级特异性）**是有意的：只有这样才能压过 `.theme-*` 的字号 / 行高声明，否则「设备档字号」会被主题字号顶掉，点 APP 看着毫无反应。
3. **各维度统一从一个出口拼 class**（`syncPreviewClass()`，app.js:854）。此前 `applyTheme()` 是整串覆盖 `preview.className`，直接加维度会被换主题冲掉——这条已用断言锁死（`preview.className = [` 全文只允许出现 1 处）。
4. **按钮组用事件委托**：一个 `click` 监听挂在 `#deviceGroup` 上，用 `closest('.seg-btn')` 取档位、读它的 `data-device`。加档位只需要往 HTML 里加一个带 `data-device` 的按钮，JS 不用改。选中态由 `syncSegBtns()` 统一同步 `.active` 与 `aria-pressed`（样式与读屏共用一份真相）。
5. **模式类不进产物**：`stripPreviewModeClasses()`（app.js:931）挂在复制与导出两条克隆路径上。模拟出来的版心 / 字号是**观察工具**，写进产物会把真实排版带偏。
6. **不参与导出**：预览模式只影响预览。导出的 PDF 走 `@media print`，与设备档无关。

### 验收标准

1. 三档设备宽度生效：PC 不限（820px 上限）/ iPad 768 / APP 375
2. APP 档的版心、字号、行高、字距与代码块折行行为符合公众号实际（见上表）；iPad 档保持 Web 排版，但按平板放大正文、放宽行距
3. 档位**全部平铺可见**，点击即可切换，当前档有可见激活态；默认 **PC**
4. 切换后写入 `localStorage['mdtu-device']`，刷新保持
5. 与主题、方格背景**多维可共存**，换主题不会冲掉其它维度
6. 复制与导出的产物里**不含** `device-*` 类

### 落地情况与实测记录

- **全量回归 465 条 0 失败**（`fm-unit` 95 + `fm-e2e` 87 + `bq-test` 58 + `ex-test` 225），其中预览模式相关断言 30 余条（`ex-test` 静态段 + B11 段），覆盖档位平铺、默认 PC、点击切换与激活态同步、`aria-pressed`、**切档不弹 Toast**、多维共存、localStorage 落盘、旧的 `mdtu-platform` 被清掉、产物剥离，以及「手动注入 pnid → 导出应剥掉」。
- **真实浏览器实测**（`.workbuddy/tools/_preview-mode-shot.js`，截图带自测量条）：

  | 档位 | 实测版心 | 内容区 | 字号 | 行高 | 字距 | 代码块 |
  |------|---------|-------|------|------|------|--------|
  | PC | **820px** | 740px | 16px | 1.6 | normal | 溢出可横滚（`white-space: pre`） |
  | iPad | **768px** | 696px | 17px | 1.7 | normal | 溢出可横滚（`white-space: pre`） |
  | APP | **375px** | 343px | 17px | 1.75 | 0.5px | 已折行（`white-space: pre-wrap`） |

  jsdom 不做布局，这三组数值只有真实 Edge 能量出来。
- **同日三轮迭代**：① 档位从两个 `<select>` 改成**平铺按钮**（点一下即切，激活态醒目）；② 平台档 `默认` 更名 **Web** 并置为默认；③ 按使用反馈**去掉平台维度**，把平台规则内建进设备档（APP = 公众号、iPad = Web + 平板适配），页头图标同步换成 `Markdown.ico`。

---

## 非目标

以下方向本期**明确不做**，避免范围蔓延：

- 后端服务、账号体系、云同步
- 图床集成（图片上传链路应单独立项）
- AI 辅助写作
- 多人协作与版本历史
- 移动端 App / 桌面客户端

> 关于 F5 与上述边界的交集：**F5 不越界**——它纯本地、不碰后端，与「云同步」无关。但**版本历史明确不做**：文件一旦落到磁盘就交给 git 管理，不应在编辑器内另造一套滚动快照；F5-d 的「外部修改检测」只做**冲突提示**，不做自动合并或历史回溯。

---

## 维护约定

1. 新增规划先登记到本文件，再在 README 的「未来功能升级」清单里加一行摘要
2. 状态变更时同步更新两处：本文件的状态列、README 清单
3. 每期结束后，把已完成项从清单移入 README 的「特性」章节
4. 涉及新增依赖或构建步骤的改动，必须先在本文件「共同前置约束」中说明理由

---

## 参考链接

- [doocs/md](https://github.com/doocs/md) — MIT，微信 Markdown 编辑器，主题系统参考蓝本
- [mdnice / markdown-nice](https://github.com/mdnice/markdown-nice) — GPL-3.0，20 套主题
- [md.axiaoxin.com](https://md.axiaoxin.com/) — 「人言兑.md」，**mdnice 的 Fork**（GPL-3.0），线上已有 101 套主题；仓库 [axiaoxin-com/wx.md](https://github.com/axiaoxin-com/wx.md)
- [md.payforchat.com](https://md.payforchat.com/) — 「MarkCopy」，**闭源**（Vite + React + Tailwind），13 套主题 + token → CSS 生成器
- [doocs/md 主题与样式定制说明](https://deepwiki.com/doocs/md/3.2-theme-and-style-customization)
- [marked](https://github.com/markedjs/marked) — 本项目的解析引擎，自定义 Renderer 文档
- [highlight.js](https://github.com/highlightjs/highlight.js) — 代码主题样式来源
- [js-yaml](https://github.com/nodeca/js-yaml) — YAML 1.2 解析，F4 建议引入（CDN UMD）
- [GitHub Docs：关于 YAML front matter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter) — 元数据字段约定
- [Obsidian：属性（Properties）](https://help.obsidian.md/properties) — 元数据的类型化展示与三档显示模式参考
- [MDN：Clipboard API](https://developer.mozilla.org/zh-CN/docs/Web/API/Clipboard_API)
- [MDN：Blob / URL.createObjectURL](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL)
- [MDN：File System Access API](https://developer.mozilla.org/zh-CN/docs/Web/API/File_System_API) — F5 主路径，`showDirectoryPicker` 所属
- [MDN：window.showDirectoryPicker()](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/showDirectoryPicker) — 需安全上下文 + 用户手势
- [MDN：FileSystemObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/FileSystemObserver) — F5-d 外部修改检测的原生方案候选
- [web.dev：The File System Access API](https://web.dev/articles/file-system-access) — 目录/文件读写与权限模型说明
