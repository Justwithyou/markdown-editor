# Markdown-Editor 项目设计方案

> 本文档基于对 `index.html` / `css/style.css` / `js/app.js` 的实际代码逐行核对整理，描述项目的**当前设计**与**设计意图**，与代码保持一致。

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 设计目标与原则](#2-设计目标与原则)
- [3. 系统架构](#3-系统架构)
- [4. 技术栈](#4-技术栈)
- [5. 界面布局设计](#5-界面布局设计)
- [6. 核心功能模块设计](#6-核心功能模块设计)
- [7. 关键实现机制](#7-关键实现机制)
- [8. 主题体系](#8-主题体系)
- [9. 数据存储](#9-数据存储)
- [10. 已知限制与风险](#10-已知限制与风险)
- [11. 未来规划](#11-未来规划)

---

## 1. 项目概述

**Markdown-Editor** 是一个开箱即用的本地 Markdown 编辑 / 预览工具，核心定位是**微信公众号排版场景**。

| 维度 | 说明 |
|------|------|
| 产品形态 | 纯静态 Web 应用，双击 `index.html` 即可运行 |
| 目标用户 | 微信公众号作者、技术写作者、需要 Markdown 排版的人群 |
| 核心痛点 | 公众号编辑器不支持 Markdown，也不支持正文外链跳转 |
| 核心价值 | 写 Markdown → 一键复制为带样式的富文本 → 直接粘贴进公众号 |
| 交付形态 | 三文件（HTML + CSS + JS），零构建、零后端、零依赖安装 |

设计原型参考了在线工具 `markdown.devtool.tech/app`，本地化后聚焦「微信公众号场景」做深度定制。

---

## 2. 设计目标与原则

1. **零构建**：不引入 `package.json`、打包器、构建步骤，改完刷新浏览器即生效。
2. **零后端**：所有数据仅存浏览器 localStorage，不上传任何服务器，无隐私风险。
3. **微信优先**：核心功能（外链转脚注、水印、富文本复制、模板）都围绕公众号排版展开。
4. **依赖走 CDN**：解析与渲染库通过 jsDelivr CDN 引入，代价是需要联网（见已知限制）。
5. **安全渲染**：用户 Markdown 渲染后的 HTML 统一经 DOMPurify 消毒，防 XSS。

---

## 3. 系统架构

### 3.1 文件结构

```
mdtu-editor/
├── index.html        # 页面结构 + CDN 依赖引入 + 图标声明（497 行）
├── Markdown.ico      # 站点图标，六帧（16/32/48/64/128/256）；页头 / 标签页 / 桌面快捷方式共用
├── css/
│   └── style.css     # 全部样式：2 套主题 + 布局 + 弹窗 + 水印 + 元数据 + 设备档预览 + 文件树抽屉 + 打开与导出下拉 + 打印（1729 行）
├── js/
│   └── app.js        # 全部逻辑：解析/渲染/大纲/水印/模板/元数据/复制/导出/导出 PDF/设备档预览/文件夹模式（3040 行）
├── README.md         # 项目说明（GitHub 标准格式）
├── ROADMAP.md        # 未来功能升级路线（独立文档）
├── DESIGN.md         # 本文档
├── F3-THEME-RESEARCH.md  # F3 外部站点主题调研与可行性分析（规划文档，落地后结论并入本文档）
├── F5-FOLDER-MODE.md # F5 文件夹模式设计方案（规划文档，落地后结论并入本文档）
├── LICENSE           # MIT
└── .gitignore
```

无任何构建产物，无 `node_modules`。

**站点图标（`Markdown.ico`）。** 仓库根只有这一个图标文件，六帧（16/32/48/64/128/256），**页头左上角、浏览器标签页 / 窗口、桌面快捷方式三处共用同一个文件**——页头是 `<img class="logo-icon" src="Markdown.ico" width="26" height="26">`（`.logo-icon` 从原先的 📝 emoji 字形换成图片，尺寸由 CSS 固定），标签页是 `<link rel="icon" href="Markdown.ico">`。**指向就是全部工作，文件本身不由本页生成、也不需要重新生成**。不另产 `favicon.ico`、没有 `apple-touch-icon.png`：几份同内容（或不同内容）的图标文件只会各说各话。要换图标，直接替换这个文件即可（三处同步生效）。

### 3.2 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  表现层  index.html（DOM 结构，JS 通过 $() 按 id 取元素）  │
├─────────────────────────────────────────────────────────┤
│  样式层  style.css（布局 + 组件 + 2 套文章主题 + 预览模式 + 水印）│
├─────────────────────────────────────────────────────────┤
│  逻辑层  app.js（IIFE 单文件，模块化函数组织）             │
│    ├─ 状态管理    state 对象 + localStorage 持久化        │
│    ├─ 渲染管线    splitFrontMatter → marked → DOMPurify → 元数据面板 → 后处理 │
│    ├─ 交互层      事件监听 / 工具栏 / 快捷键 / 弹窗         │
│    └─ 数据层      localStorage 读写封装                    │
├─────────────────────────────────────────────────────────┤
│  依赖层  CDN：marked / highlight.js / KaTeX / Mermaid /   │
│         DOMPurify / js-yaml（jsDelivr 引入）              │
└─────────────────────────────────────────────────────────┘
```

### 3.3 核心数据流（渲染管线）

```
编辑器文本(textarea)
      │
      ▼
splitFrontMatter()         ← 剥离首部 YAML 元数据（必须在 marked.parse 之前）
      │                        └─→ buildFrontMatterBlock() 生成顶部「属性」面板
      ▼
marked.parse(body)         ← 自定义 renderer.link（外链转脚注）；breaks: true（单行换行 → <br>）
      │
      ▼
DOMPurify.sanitize()       ← 防 XSS，白名单标签/属性
      │
      ▼
拼接元数据面板              ← 面板拼在正文之前（自产标记，已转义，不经 marked/DOMPurify）
      │
      ▼
applyAutoNumbering()       ← 可选：H1–H3 自动编号（面板内无 <h*>，不受影响）
      │
      ▼
preview.innerHTML = html  ← 写入预览区
      │
      ├─→ 追加参考文献区块（外链脚注模式）
      ├─→ renderMermaidFromDOM()   ← 异步渲染 Mermaid 为 SVG
      ├─→ renderMath()             ← KaTeX auto-render
      ├─→ updateCounts()           ← 字符/词/行统计（只统计正文）
      ├─→ updateFmModeControl()    ← 有元数据时才露出档位控件
      └─→ updateOutline()          ← 大纲实时更新（跳过元数据占用的行）
```

---

## 4. 技术栈

| 库 | 版本 | 用途 |
|----|------|------|
| [marked](https://github.com/markedjs/marked) | 4.3.0 | Markdown 解析（**锁定 v4**） |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 11.9.0 | 代码语法高亮 |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 0.16.9 | 数学公式渲染 |
| [Mermaid](https://github.com/mermaid-js/mermaid) | 10.9.0 | 文本图表（流程图/时序图/类图） |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.1.6 | HTML 消毒防 XSS |
| [js-yaml](https://github.com/nodeca/js-yaml) | 4.1.0 | 解析文档首部 YAML 元数据（固定 `CORE_SCHEMA`） |

> ⚠️ **marked 版本约束**：项目锁 v4。v12 的 `renderer.link` 签名与 v4 不兼容，升级会导致「外链转脚注」失效，改动前必须先确认 API 差异。

---

## 5. 界面布局设计

### 5.1 三段式顶栏（`.app-header`，高 56px）

| 区域 | 内容 |
|------|------|
| 左侧 `.header-left` | Logo：`📝 Markdown-Editor` |
| 中间 `.header-center` | 主题切换（**2026-10-13 起放开供评估**）、大纲、自动编号、插入目录、方格背景、使用模板、水印 |
| 右侧 `.header-right` | **打开（下拉菜单：文件 / 文件夹）**、更多工具、外链转脚注、**导出（下拉菜单）**、**复制（primary 主按钮）** |

**装不下时怎么办。** 顶栏在 1280px 宽度下本来就装不下（F5 之前 `#btnExport` / `#btnCopy` 已落到可视区外）。现在的规则是：**中间那组退化成可横向滚动的条，右侧主操作（打开 / 导出 / 复制）永不缺席**——`.header-left` / `.header-right` 都是 `flex-shrink: 0`，`.header-center` 加 `min-width: 0; overflow-x: auto; justify-content: safe center`（`safe` 必不可少：居中溢出会把左端裁掉且滚不回去）。这与编辑工具栏 `.editor-toolbar` 的既有做法一致。

**两个入口收进下拉，而不是各占一个按钮。** F5-a 落地的第一版把「文件夹」直接摆在顶栏上，于是顶栏净增一个按钮、挤掉「外链转脚注」。改为：**「打开」按钮 + 菜单里的「文件」「文件夹」两项**，与「导出」下拉共用同一套骨架（`.export-wrap` / `.export-menu` / `.export-item`），样式表只补 `#openWrap.single .export-caret`（不支持文件夹 API 时菜单只剩一项，收掉箭头）。

**下拉菜单宽度跟着内容走。** 早先 `.export-menu` 写死 `min-width: 216px`，加上 `.export-item .export-ext` 的 `margin-left: auto`，短标签行的右侧会空出一大块。现在菜单是 `width: max-content; min-width: 0; max-width: 260px`，`.export-ext` 只保留 `margin-left: 8px` 的自然间距——**两个下拉（打开 / 导出）都收缩到实际内容宽度**，实测 172–174px 且行内标签到后缀的间隙 ≤12px，有真实浏览器的宽断言盯着。

### 5.2 主区双栏（`.app-main`）

```
┌───────────────┬──┬───────────────────┐
│  编辑面板       │  │   预览面板          │
│  ┌───────────┐ │  │  ┌──────────────┐ │
│  │ 编辑工具栏  │ │  │  │ 预览工具栏    │ │
│  ├───────────┤ │r │  ├──────────────┤ │
│  │ textarea  │ │e │  │  markdown-   │ │
│  │  编辑器    │ │s │  │  body 渲染区  │ │
│  ├───────────┤ │i │  └──────────────┘ │
│  │ 状态栏     │ │z │                   │
│  └───────────┘ │e │                   │
└───────────────┘r─┴───────────────────┘
```

- **编辑面板**：编辑工具栏（18 个语法插入按钮 + URL 采集 + 清空）→ textarea 编辑器 → 状态栏（字符/词/行统计）。
- **预览面板**：预览工具栏（**设备档一组平铺档位按钮**、元数据档位、同步滚动、全屏、全屏页宽控件）→ `.preview-scroll`（带动画的滚动容器）→ `.preview-wrap`（真正的滚动容器）→ `.markdown-body`（渲染正文）。全屏时**设备档整组与「退出全屏」之外的控件一起被 JS 收起**（见 7.9）。
- **分隔条 `.resizer`**：可拖拽调整两栏比例（`mousedown/mousemove/mouseup`，15%–85% 范围限制）。

### 5.3 弹窗组件

| 弹窗 | 尺寸 | 用途 |
|------|------|------|
| `#templateModal` | 720px | 模板管理（列表 + 编辑器） |
| `#urlModal` | 460px (modal-sm) | URL 链接采集 |
| `#linksModal` | 760px (modal-lg) | 工具/开源项目导航（三 Tab） |
| `#watermarkModal` | 680px (modal-md) | 水印设置（左表单 + 右预览） |

另有悬浮组件：文档大纲 `.outline-panel`（右侧垂直居中悬浮）、**文件树抽屉 `.file-tree-panel`**（左侧，F5，见 7.10）、**抽屉入口 `.tree-peek`**（抽屉收起后浮在内容上层的 44×44 实心蓝圆球，按下变橙，可拖动、位置记在 `mdtu-tree-peek-pos`，只在「有工作区 + 抽屉收起」时出现）、Toast 提示 `.toast`。

---

## 6. 核心功能模块设计

### 6.1 编辑与渲染

- **分屏实时预览**：左写右渲，`input` 事件驱动 `renderMarkdown()`。
- **双向同步滚动**：编辑区与预览区按滚动比例互相映射，可关闭（`#btnPreviewScroll`）。
- **代码高亮**：marked `highlight` 回调 → `hljs.highlight / highlightAuto`。
- **数学公式**：KaTeX auto-render，支持 `$...$` / `$$...$$` / `\(...\)` / `\[...\]`。
- **Mermaid**：识别 `code.language-mermaid`，异步渲染为内联 SVG。
- **GFM 语法**：表格、任务列表、删除线、引用等由 marked 原生支持。

### 6.2 微信排版（核心场景）

| 功能 | 设计要点 |
|------|----------|
| **复制到公众号** | `cloneNode` 预览 → 注入主题 `<style>` → `execCommand('copy')` 富文本复制，保留代码高亮与样式 |
| **外链转脚注** | 正文 http(s) 链接转上标 `[n]`，文末生成「参考文献」区块，绕开公众号外链限制 |
| **水印** | 文字/颜色/字号/透明度/角度/间距可调，预览与复制双路径渲染（见 7.3） |
| **模板** | `{{ content }}` 占位符机制，预置头尾结构一键套用 |

### 6.3 效率工具

| 功能 | 说明 |
|------|------|
| 文档大纲 | 扫描 H1–H6，点击左（源码）右（预览）双栏联动跳转 |
| 全屏预览 | 预览区全屏 + Esc 退出；进全屏即**锁定当前设备档**（设备档整组隐藏），iPad / APP 档不给页宽 |
| 页宽调节 | 窄 680 / 中 880 / 宽 1100 / 超宽 1400 / 全屏宽（纸张感）；**仅 PC 档可用** |
| 自动编号 | H1–H3 多级编号 |
| 插入目录 | 自动生成 TOC |
| 方格背景 | 便于截图对齐 |
| 打开文件 | 「打开」下拉里的**「文件」**：读本地 `.md/.markdown/.txt/.mdx` |
| 打开文件夹 | 「打开」下拉里的**「文件夹」**：F5-a 只读文件树（见 7.10） |
| 文档元数据 | 识别首部 YAML Front Matter，渲染为顶部「属性」面板（类型图标 + 标签 / 布尔 / 日期类型化，三档展示，见 7.7） |
| URL 采集 | 输入网址抓正文转 Markdown |
| 更多工具 | 内置同类工具与开源项目导航（三 Tab） |
| 主题 | 2 套文章主题（GitHub / 晴空蓝，见第 8 节） |
| 预览模式 | 设备档（PC / iPad / APP）平铺档位；每档内建该尺寸下的阅读场景（Web / Web + 平板适配 / 公众号），只影响预览、不进产物（见 7.9） |
| 导出 | 复制 Markdown 源码 / 导出 HTML / 导出 PDF（下载）/ 导出 Word（`.doc`）/ 打印，详见 7.8 |

### 6.4 持久化

编辑内容自动写入 localStorage，刷新不丢；模板、水印配置、主题、预览设备档、页宽同样本地化存储。

---

## 7. 关键实现机制

### 7.1 渲染管线（`renderMarkdown()`，app.js:547）

按固定顺序执行：`splitFrontMatter` → `marked.parse`（配置含 `breaks: true`、`gfm: true`，见第 8 节「换行语义」）→ `DOMPurify.sanitize`（白名单：`ADD_TAGS` 含 sup/sub/span/div 等，`ADD_ATTR` 含 class/style/id/href 等）→ 拼接元数据面板 → 自动编号 → 写 DOM → 后处理（脚注/图表/公式/统计/大纲/元数据档位）。

### 7.2 外链转脚注（`renderer.link`，app.js:275）

重写 marked 的 `renderer.link`：当 `state.footnoteLinks` 开启且 href 为 http(s) 时，用计数器生成上标 `[n]`，并把链接收进 `footnoteList`，渲染完成后在文末追加 `.footnote-section` 参考文献区块。

### 7.3 水印双路径渲染（微信兼容性关键）

| 路径 | 函数 | 机制 | 原因 |
|------|------|------|------|
| 预览 | `buildWatermarkUrl()` | 生成 SVG data URI 作 CSS 平铺背景 | 性能好、不污染 DOM |
| 复制 | `injectWatermarkNodes()` | 绝对定位 `<span>` 平铺铺满容器 | 微信会过滤 SVG data URI 背景，DOM 节点粘贴后更易存活 |

### 7.4 富文本复制（`copyToClipboard()`，app.js:941）

克隆预览 → **摘掉 `[data-fm-ui]` 元数据标题行** → 清空背景 → 注入 `getThemeStyles(theme)` 的 `<style>` 块 → 注入 DOM 水印 → `Range` 选区 + `execCommand('copy')`，失败则降级为纯文本复制。用废弃但兼容性最好的 `execCommand` 实现富文本复制。

### 7.5 大纲双向联动（app.js:1815–2077）

- `getSourceHeadings()`：扫描源码 ATX 标题（跳过围栏代码块）记录行号。
- `buildOutline()`：把预览区 `<h1..h6>` 通过「层级 + 归一化文本」匹配回源码行号。
- 点击跳转：编辑器用镜像 div 测量行偏移后平滑滚动；预览区用 `getBoundingClientRect` 差值滚动。
- `suppressSync(600)`：跳转期间临时关闭双向同步，避免两栏互相拉扯。

### 7.6 同步滚动（app.js:1536 起）

编辑区与预览区滚动事件互相映射，按 `scrollTop / (scrollHeight - clientHeight)` 比例同步；`syncBlocked()` 判断抑制窗口。**真正的滚动容器是 `#previewWrap`**（`overflow:auto` 在它身上），不是 `#previewScroll`。

### 7.7 文档元数据（Front Matter，app.js:328–545）

形态：**Obsidian 风格的「属性」面板**——圆角卡片，一行一个属性（`类型图标 + 键 + 值`），键列定宽使值左边缘对齐，行间一条极淡分隔线，顶部一行 `属性 · n 项` 小标题。**嵌套对象与数组递归展开**：分组键渲染为「容器行」（右侧显示直接子项数），子级缩进并由左侧竖线标出层次，数组元素以 `[0]` `[1]` 作行标。

| 环节 | 函数 | 要点 |
|------|------|------|
| 剥离 | `splitFrontMatter(src)` | 只认**文件首行**的 `---`…`---` 块（允许 BOM / CRLF）；块内需至少有一行 `key: value`（`tags:` 这类空值写法也算）才认定，避免把以 `---` 分割线开头的正文吃掉。返回 `{ raw, data, body }`，`body` 已去掉紧随闭合 `---` 的空行 |
| 解析 | `jsyaml.load(raw, { schema: CORE_SCHEMA })` | **必须显式用 `CORE_SCHEMA`**：默认 schema（YAML 1.1）会把 `date: 2026-09-20` 解析成 `Date` 对象，序列化后是 `2026-09-20T00:00:00.000Z`，东八区显示成前一天 |
| 兜底 | 同上 | `js-yaml` 未加载 → 退回原行为；YAML 语法错误或结果不是键值对象 → 仍剥离（正文不该出现 `<hr>` + 假标题），但回退为「源码」形态并提示 |
| 类型 | `fmTypeOf(key, v)` | 决定键前的线条图标：`text` / `list` / `number` / `checkbox` / `date` / `datetime` / `tag` / `folder`；`tags`·`keywords`·`categories` 一律按 `tag`，数组走 `list`，空对象走 `folder` |
| 容器判定 | `fmIsContainer(v)` | **决定是否展开**：非空对象，或「至少含一个对象元素」的数组，才算容器；**标量数组不是容器**——`tags: [a, b]` 因此仍在一行里渲染成胶囊，不会被拆成一堆单行 |
| 计数 | `fmLeafCount(v)` | 递归数叶子属性。标题行与状态栏共用这一口径，避免"顶层 2 个键 / 展开 10 行"时数字对不上 |
| 渲染 | `fmRenderNode(name, value, pal, withDivider)` + `buildFrontMatterBlock(fm)` | 递归渲染：容器 → `容器行（键 + n 项）` + `.fm-children`（缩进 + 左边框竖线）内递归子级；叶子 → 单行。值类型化：数组 → 胶囊标签（单值 `tags` 同样渲染成标签）、布尔 → `✓`/`✗`、日期 → `YYYY-MM-DD`、空容器 → `—` |
| 样式 | `FM_PALETTE` + `FM_ICON_PATHS` | **直接输出内联 style**（按主题取色），不依赖 `getThemeStyles()`——公众号会剥离 `<style>`，内联样式才可靠。代价是换主题必须重渲染，故 `applyTheme()` 里补了 `renderMarkdown()`。图标用 `stroke="currentColor"`，颜色同样内联 |
| 档位 | `#fmModeSelect` | `panel`（默认）/ `codeBlock` / `hide`，写入 `mdtu-frontmatter`（读到旧值 `table` 时自动迁移为 `panel`）；控件放在预览工具栏而非面板上——否则「隐藏」后控件会随块一起消失，且控件会被复制进公众号 |

联动改动（元数据必须与正文逻辑解耦）：

- `updateCounts()`：只统计 `body`，状态栏额外显示「元数据 N 项（未计入）」——N 与面板标题行同用 `fmLeafCount()` 的叶子口径
- `getSourceHeadings()`：跳过元数据占用的行——否则 YAML 注释（`# ...`）会被 ATX 标题正则误判为标题
- `generateTOC()`：目录只在正文区间内查找与插入，保证元数据始终留在文件最顶部
- 面板内**不出现任何 `<h*>`**，因此天然不参与 `applyAutoNumbering()`，也不会混进大纲
- `copyToClipboard()`：克隆预览后先摘掉 `[data-fm-ui]`（即 `属性 · n 项` 标题行）——它是应用 UI，不该出现在公众号文章里；卡片与标签的内联样式则原样带出

**为什么不用现成的树查看器**：Obsidian 的 `nested-properties` / `nested-frontmatter-properties` 都依赖 Obsidian 内部 API，不能用于独立网页；Front Matter CMS 是 VS Code 扩展工程；通用 JSON 树查看器（JsonTree.js、`@vdonec/json-view`、tree.json）虽然是 CDN 可引入的 UMD，但观感是「代码调试器」，且**输出 class 样式**——与「元数据必须内联样式才能在公众号存活」这条硬约束直接冲突，也不认 YAML 语义类型。结论是只借交互模型、渲染自己写，代价约 30 行递归，换来零新增依赖。

### 7.8 导出能力（`// ===== Export (F1) =====`，app.js:1041–1316；`// ===== 导出 PDF（下载）=====`，app.js:1318–1484）

顶栏「复制」**左侧**新增**「导出」下拉**（`index.html:118–152`，样式 `style.css:181–282`），把五个动作收进一个菜单，避免顶栏按钮继续横向膨胀。除「打印」外的四个动作全部通过**浏览器下载**落盘（`Blob` + `URL.createObjectURL` + `<a download>`），不经过任何服务端；**零新增运行时依赖**——`html2canvas` / `jsPDF` 只在第一次点「导出 PDF」时才从 CDN 拉（`loadScriptOnce()` app.js:1329 + `ensureLib()` app.js:1348）。

| 动作 | `data-export` | 实现 | 产物 |
|---|---|---|---|
| 复制 Markdown | `md` | `navigator.clipboard.writeText(editor.value)`，失败降级 `document.execCommand('copy')` | 剪贴板（纯文本） |
| 导出 HTML | `html` | `buildStandaloneHtml()`（app.js:1180）→ `downloadBlob()` | `text/html` / `.html` |
| 导出 PDF | `pdf` | `exportPdfFile()`（app.js:1378）：离屏渲染 → A4 切片 → `jsPDF.addImage` → `downloadBlob()` | `application/pdf` / `.pdf`（**直接下载**） |
| 导出 Word | `word` | `buildWordHtml()`（app.js:1241）→ `downloadBlob()` | `application/msword` / `.doc` |
| 打印 | `print` | `printDocument()`（app.js:1312）＝ `window.print()` + `@media print` | 系统打印对话框（可选「另存为 PDF」） |

**「导出 PDF」与「打印」为什么拆成两条路。** 原先只有一条（`window.print()`），菜单里却叫「导出 PDF」，用户点下去得到的是一个打印对话框，认知落差大。现在按**产物形态**分开：

- **导出 PDF（下载）**：`exportPdfFile()` 把 `clonePreviewForExport()` 挂到一个 900px 宽的离屏舞台（`PDF_STAGE_W` app.js:1359），`html2canvas` 出整张长图 → 按 A4 可用高度（`PDF_USABLE_H` app.js:1358，A4 高 841.89pt 减上下各 24pt 边距）逐段切片 → `findBlankCut()`（app.js:1363）在目标切点附近向下找一行**全白**像素再切，避免把一行字拦腰截断 → 每片 `canvas.toDataURL('image/jpeg', 0.92)` → `pdf.addImage(..., 'JPEG', …)`。点一下就拿到文件。
  - **代价必须说清**：PDF 里是图片，**文字不可选中、不可检索**；这条写进了 Toast 与 README「已知限制」。
  - **像素密度自适应**：浏览器对画布总面积有上限，超了会静默失败或出白纸。渲染前先估面积，`scale` 依次降 2 → 1.5 → 1；连 1 倍都放不下就**明确拒绝并提示改用「打印」**，绝不交出一份被截断的文档。
  - **体积教训**：最初用 PNG 切片，10 页 68 MB；改为 `getContext('2d', { alpha: false })`（省掉 alpha 通道）+ JPEG 0.92 后，同样内容约 1.1 MB。
- **打印**：仍是原来的 `printDocument()` → `window.print()`，输出**矢量、文字可选**，只是不再对外宣称是「导出 PDF」；需要在对话框里选「另存为 PDF」，这一步现在由用户自己决定。

`runExport(kind)`（app.js:1467）负责分发：`'print' → printDocument()`、`'pdf' → exportPdfFile()`，其余保持原下载路径。

**导出 HTML 的自包含性（`buildStandaloneHtml()`，app.js:1180）。** 组装顺序有语义，已被静态断言锁定：

```
EXPORT_PAGE_CSS → getThemeStyles(state.theme) → 内联的 CDN CSS（hljs / KaTeX）
   → 取不到时的 <link> 回退 → 水印 CSS → clonePreviewForExport().outerHTML
```

三点必须记住：

1. **外壳样式必须排在主题样式之前**。主题样式会在 `body, div` 上声明背景色；外壳（`body { margin: 0; padding: 24px 16px }` 等）若排在后面，深色文档会变成「白底浅字」。
2. **CSS 里的 `url()` 必须绝对化**（`absolutizeCssUrls()`，app.js:1145）。KaTeX 的 `@font-face` 写的是 `url(fonts/KaTeX_*.woff2)`，内联后相对路径会以**导出文件所在目录**为基准 → 字体全 404、公式退回系统字体。白名单跳过 `data:` / `http(s):` / `//` / `#`。
3. **取不到就回退，不能静默丢**。`readCssText()`（app.js:1118）先走 CSSOM（`document.styleSheets[i].cssRules`，跨域读会抛 `SecurityError`），再走 `fetch(href, { mode: 'cors' })`；两条都失败时 `collectExportCss()` 把 href 记进 `fallback`，最终渲染成 `<link rel="stylesheet" href="https://…">`。取到的文本缓存在 `exportCssCache`（app.js:1117），避免两次导出重复拉取。

导出前先 `clonePreviewForExport()`（app.js:1106）克隆预览子树，并摘掉三类**属于应用 UI、不该进导出文件**的东西：行内残留的 `style` 属性（如方格背景）、`grid-bg` class，以及 `data-page-node-id` 这类**编辑器专用属性**。元数据 YAML 原文则以 HTML 注释保留（`exportFrontMatterComment()`，app.js:1175），方便拿到文件后二次编辑。

> **`data-page-node-id` 是什么？** 这份 `index.html` 一旦托管成 WorkBuddy 资料库的「页面」，页面平台就会给每个元素打上这个东西（内部叫 `pnid`），用于**节点级评论**与**「划词让 AI 改」的改动定位**（见内置 `library` 技能的 `page/edit-flow.md`）。它对运行没有任何影响，但会随 `preview.cloneNode(true)` 混进公众号与导出文件。**2026-10-13 已确认项目里零处读取它，整批清除了 312 处**；`stripEditorOnlyAttrs()`（app.js:919）留在 `copyToClipboard()`（app.js:942）与 `clonePreviewForExport()`（app.js:1106）两条克隆路径上做防御——文件若再被托管回资料库，属性会重新出现。ex-test 有一条「手动注入 pnid → 导出应剥掉」的用例锁着这段逻辑。

**打印样式（`style.css:1638–1729`），六组规则：**

1. **隐藏界面壳子**：`.app-header` / `.editor-panel` / `.resizer` / `.preview-toolbar` / `.outline-panel` / `.toast` / `.modal-overlay`
2. **解除页面级锁定**：`html, body { height: auto; overflow: visible }`、`body { display: block }`、`.app-main { display: block; overflow: visible }`
3. **逐层解开三层滚动容器**：`.preview-panel` → `.preview-wrap` → `.preview-scroll`。**这条是成败关键**——不解开的话内容会被 `overflow: hidden` 截断在第一屏（实测：去掉打印样式只打印 1 页，补上后 4 页）
4. **`.markdown-body` 退化成普通文档流**：`max-width: none` / `padding: 0` / 去掉阴影
5. **`#preview { print-color-adjust: exact }`**：暗色主题按原色打印，不被浏览器「省墨」洗成白底
6. **分页控制**：`pre` / `blockquote` / `table` / `.mermaid-rendered` / `.katex-display` / `.fm-block` 加 `break-inside: avoid`，`h1`–`h6` 加 `break-after: avoid`，`p, li` 设 `orphans: 2; widows: 2`

另有 `@page { margin: 16mm }` 放在 `@media print` **之外**（`style.css:1643`，`@media print` 从 `:1647` 起）——`@page` 本身就是页面级 at-rule，放外面更直观，两条规则都有断言盯着。

**导出 Word 的兼容性子集（`buildWordHtml()`，app.js:1241）。** `application/msword` + `.doc` 套壳，本质仍是 HTML。Word / WPS 只认一小撮 CSS，因此：

- **不认 `em`**：`WORD_COMPAT_CSS`（app.js:1064）一律用 `pt`（正文 12pt、h1 20pt、h2 16pt、h3 14pt、`pre` 10pt）
- **不认 flex**：元数据面板经 `fmPanelToTable()`（app.js:1203）降级为 `<tr><td>键</td><td>值</td></tr>`，`.fm-row` 递归摊平，嵌套层级用缩进表达
- **MSO 头**：`<w:WordDocument><w:View>Print</w:View>` + `@page WordSection1`，让 Word 以「页面视图」而非「Web 版式」打开
- **不带水印**：水印的两条实现（SVG data URI 背景 / 绝对定位 `<span>`）在 Word 里都不可靠，索性不写入

**文件名规则（`getDocBaseName()`，app.js:1100）。** 优先取元数据 `title` → 正文首个 H1 → 兜底 `document`；再过 `sanitizeFileName()`（app.js:1087）清洗 Windows 非法字符（`\ / : * ? " < > |`）、剥掉 Markdown 强调标记与 `[文字](链接)` 的链接部分，并截断到 80 字符。

**顺带修复的既有回归：`unfoldDisplayMath()`（app.js:642）。** `breaks: true` 会把段落内换行变成 `<br>`，于是多行写的块级公式在 DOM 里成了 `<p>$$<br>\int…<br>$$</p>`。KaTeX 的 auto-render 按**文本节点**匹配定界符，`$$` 被 `<br>` 拆成多个文本节点后就再也配不上——**整个块级公式不渲染**（行内 `$x$` 不跨行，因此不受影响）。修复：`renderMath()`（app.js:651）开头先调 `unfoldDisplayMath()`，对「整段就是一个块级公式」（`$$…$$` 或 `\[…\]`）的段落把 `<br>` 换回 `\n`，合回单个文本节点。

---

### 7.9 预览模式：设备档

同一篇稿子在 PC、平板、手机上的观感差别很大，而这个差别只有到发布那一刻才暴露。预览工具栏左侧的**一组设备档按钮**（`index.html:265–271`）把这个差别提前搬到预览里。

**一、只有设备一个维度，平台规则内建在档位里。** 早期版本把「设备端」与「展示端（Web / 公众号 / 掘金）」拆成两个正交维度，后来**合并成一维**——因为每档设备其实只对应一种典型阅读场景，让用户自由组合反而会造出「PC × 公众号」这种现实中不存在的组合：

| 档位 | `state` 键 | 预览容器 class | 设备视口 | 排版基调 |
|------|-----------|---------------|---------|---------|
| PC（默认） | `pc` | `device-pc` | 不限宽，上限 820px | Web —— 主题原貌 |
| iPad | `ipad` | `device-ipad` | `--dev-max: 768px` | Web + 平板适配（正文 17px / 行高 1.7 / 内边距加宽） |
| APP | `app` | `device-app` | `--dev-max: 375px` | 公众号（正文 17px / 行高 1.75 / 字距 +0.5px / 长代码行硬折行） |

合并后旧存档里的 `mdtu-platform` 由 `init()` 主动 `removeItem` 清掉，免得留着让人以为还能选。

**二、档位平铺成按钮组，不塞进 `<select>`。** 三档全部显示在工具栏上，点一下就切——比下拉少两次操作，也免了「选了哪档要展开才知道」。样式复用「页宽」那排的 `.width-btn` 盒子与激活态（`.seg-btn` 与它同一份规则），只补一个成组容器 `.seg-group`：

```html
<div class="toolbar-group" id="previewModeGroup">
  <span class="width-label">设备</span>
  <div class="seg-group" id="deviceGroup" role="group" aria-label="预览档位">
    <button type="button" class="seg-btn" data-device="pc" aria-pressed="true">PC</button>
    …
  </div>
</div>
```

事件用**委托**挂在组上（`#deviceGroup` 一个 `click` 监听，`e.target.closest('.seg-btn')` 取档位），HTML 里加档位只需加一个 `data-device` 按钮，JS 不用动。选中态由 `syncSegBtns()`（app.js:893）统一同步：同时维护 `.active` 与 `aria-pressed`，样式与读屏共用一份真相。

**三、class 的单出口拼装（`syncPreviewClass()`，app.js:854）。** 预览容器的 class 由「主题 + 方格背景 + 设备档」三件事共同决定：

```js
preview.className = [
  'markdown-body', 'theme-' + state.theme,
  state.gridBg ? 'grid-bg' : '',
  'device-' + state.device,
].filter(Boolean).join(' ');
```

全文**只允许这一处写 `preview.className = [`**（ex-test 有断言 `eq((appSrc.match(/preview\.className = \[/g)||[]).length, 1)` 锁着）。任何一处直接整串覆盖，都会把其余几维静默冲掉——这是多维共存能被破坏的唯一方式。`applyTheme()` / `applyDevice()` 都只改 `state` 再调它，方格背景按钮也从 `classList.toggle('grid-bg', …)` 改为同一出口。

**四、版心：设备视口压一道 820px 上限（`style.css:498–500`）。**

```css
.markdown-body {
  max-width: min(var(--dev-max, 820px), 820px);
}
```

只有设备档设 `--dev-max`（iPad 768px / APP 375px），PC 档不设、回落到 820px，与改造前完全一致。（平台维度合并后，原先的 `--plat-max` 变量已删除。）

> 注意 `max-width` 是 `border-box` 宽度。APP 档的 `--dev-max: 375px` 含 `padding: 22px 16px`，实际内容区是 **343px**——这正是手机屏的真实情况。

**五、设备档的选择器必须写两级（特异性陷阱）。**

```css
.markdown-body.device-app { --dev-max: 375px; font-size: 17px; line-height: 1.75; letter-spacing: .5px; }
```

主题段的 `.theme-*` 同样声明 `font-size` / `line-height`，而且排在设备档段**之后**。若设备档写成单级 `.device-app`，特异性 0-1-0 会输给 `.theme-*` 的 0-1-0（后者在源码里靠后）→ 字号纹丝不动、切到 APP 看着毫无反应。写成 `.markdown-body.device-app`（0-2-0）才能稳定压过主题。

**六、APP 档为什么套公众号的度量。** APP 档模拟的是「在手机上看这篇公众号文章」：

- 公众号正文**版心约 677px**，明显宽于手机屏——所以实际版心由 375px 视口决定。
- 正文按微信的来：**17px / 行高 1.75 / 字距 +0.5px**（微信正文默认带这点字距）。
- 长代码行**按微信规则硬折行**：`pre { white-space: pre-wrap; overflow-wrap: anywhere }`。微信正文**不支持横向滚动**，长行会被折断；预览就按折行显示，把这个问题提前暴露，而不是等粘贴进公众号后台才发现。

iPad 档则相反，**不套**公众号那套字距与折行——它模拟的是「在平板上浏览网页」，所以保持 Web 排版，只把正文放大到 17px、行高放宽到 1.7、内边距加宽，并按平板屏宽收一点标题字号。

**七、模式类不进产物（`stripPreviewModeClasses()`，app.js:931）。** `device-*` 是**观察工具**，不是文章内容：模拟出来的版心与字号若被当成真实排版带进公众号或导出文件，就是错的。它和方格背景、`data-page-node-id` 一样，在**两条克隆路径**（`copyToClipboard()` app.js:942、`clonePreviewForExport()` app.js:1106）上被摘掉：

```js
const cloned = stripPreviewModeClasses(stripEditorOnlyAttrs(preview.cloneNode(true)));
```

ex-test 断言导出产物中不含 `device-`，且容器类只剩 `markdown-body theme-github`。

**八、三档的实测值。** 用真实 Edge 的 `getBoundingClientRect()` / `getComputedStyle()` 量，值直接印在截图自测量条上（脚本 `.workbuddy/tools/_preview-mode-shot.js`）：

| 档位 | 版心 | 内容区 | 正文字号 | 行高 | 字距 | 长代码块 |
|------|------|-------|---------|------|------|---------|
| PC | 820px | 740px | 16px | 1.6 | normal | 可横向滚动 |
| iPad | 768px | 696px | 17px | 1.7 | normal | 可横向滚动 |
| APP | 375px | 343px | 17px | 1.75 | 0.5px | 折行（`white-space: pre-wrap`） |

**九、全屏 = 锁定当前档位。** 全屏是「安静读」的场景，进去之后不该还能来回切档。`enterFullscreen()` 做三件事：把设备档整组（`#previewModeGroup`）`display:none`；**页宽组只在 PC 档显示**——iPad / APP 的版心由 `--dev-max` 决定，而页宽走的是 inline `max-width`，叠上去会直接压掉版心，两者互相打架，所以非 PC 档索性不给；进入前是 iPad / APP 档时，把上一次遗留的 inline `max-width` 与 `page-mode` 清掉，**把版心交还给设备档**。`.device-*` class 一直挂在 `#preview` 上、全屏期间不动，所以「按当前档位渲染」不需要额外代码。退出全屏（按钮或 `Esc`）再把这几个 `display` 还原。

`applyDevice()`（app.js:903）负责落盘（`mdtu-device`）、同步按钮激活态（`syncSegBtns()`）与 `previewScroll.classList.toggle('device-frame', …)`（非 PC 档压深底衬，设备边界才看得见）；`init()` 里用 `pickSaved()` 校验存档值后套用。**切换不弹 Toast**：档位本身就写着 `PC` / `iPad` / `APP`、按钮高亮即选中态，变的是正文本身；再弹一个浮层挡住正文并停留 2.5s，是纯粹的信息噪声。工具栏上也不写「设备」二字——三个档位自明，多一个标签只是占掉横向空间。

---

### 7.10 文件夹模式（F5-a，只读）

`js/app.js` 末尾的 `// ===== F5：文件夹模式（只读）=====` 段。目标是「打开一个本地目录 → 文件树 → 点节点切换文档」，**本期全程不写盘**：不保存、不新建、不重命名、不删除。

**能力探测分三层，逐层降级**。探测只判函数是否存在——该 API 由 `[SecureContext]` 门控，非安全上下文里连函数都不存在，所以这一行同时蕴含了「当前是不是安全上下文」：

| 层 | 判据 | 结果 |
|---|------|------|
| ① | `typeof window.showDirectoryPicker === 'function'` | 完整模式：能拿到目录句柄（Edge / Chrome，`file://` 亦可用） |
| ② | `'webkitdirectory' in input` | 只读快照模式：`<input webkitdirectory>` 给的扁平文件列表，按 `webkitRelativePath` 补出树 |
| ③ | 都不成立（Firefox / Safari） | **入口与抽屉整块从 DOM 摘掉**，退回单文档模式 |

**节点模型**：`{ name, kind, path, ref, children, loaded, loading, error }`。`path` 是工作区内的相对路径，同时充当文档 id；`ref` 在完整模式下是 `FileSystemHandle`、在快照模式下是 `File` 对象；`children === null` 表示「还没枚举过」，空数组才是「真的是空目录」。

**枚举是懒的，但为了剪掉空壳目录会往下探一层。** 真正把子项铺开只发生在「已展开」的目录（`loadChildren()` 里的 `for await (const h of node.ref.values())`），子目录点开才递归读——不这么做，几千文件的目录会直接卡死 UI。但「这个目录里到底有没有文档」得先知道，才谈得上不显示它，所以 `loadChildren()` 会对每个子目录调一次 `hasMarkdownDeep()`：**见到第一个 `.md` 立刻返回**（常规文档目录只读几个条目），并带 `TREE_PROBE_MAX` 预算——累计扫过的条目数到顶就一律判「有」，宁可多留一个目录，也不因为预算用尽就错杀一整棵有文档的子树。默认忽略 `node_modules` / `.git` / `dist` / `build` / `out` / `.next` / `.venv` / `__pycache__` / `.DS_Store`，命中即整棵剪掉；排序是「目录在前、文件在后」+ `localeCompare(zh, { numeric: true })`（`numeric` 必需，否则 `第10章` 会排到 `第2章` 前面）。单个子目录读失败只局部标红，**不中断整棵树**。

**只展示 Markdown，没有文档的目录整条不进树。** 树的构建把过滤**放在枚举层**（`loadChildren()` 里 `isMdName()` 不过关直接丢掉、不入队），快照模式同理由 `buildSnapshotTree()` 处理——不是「先建好再 CSS 隐藏」。白名单是 `TREE_MD_EXT = ['md','markdown','mdx']`。**目录不再「一律保留」**：完整模式靠 `hasMarkdownDeep()` 逐个子目录探（见上段），快照模式在建完树后自下而上跑一遍 `prune()`，两边都做到「**整棵子树没有 Markdown ⇒ 连文件夹都不显示**」。之所以不留空目录，是因为一个「点开才发现里面是空的」壳子比干脆不显示更让人困惑；同理也不再逐层报「已过滤 N 个非 Markdown 文件」，打开工作区时只提示一句「仅显示 Markdown 文档」。

**切换文档 = 换 `editor.value` + 调一次 `renderMarkdown()`**：换完把两个滚动容器显式拉回顶部并 `suppressSync()`，再 `saveContent()` 沿用单文档那套存档（刷新后仍停在这篇）。

**编码判据（这也是 F5-b 关闭写回通道的依据，先在这里定下来）**：`decodeBytes()` 按「UTF-8 BOM → UTF-16 BOM → 严格 UTF-8（`TextDecoder('utf-8', { fatal: true })`）→ 失败即判非 UTF-8，回退 `TextDecoder('gbk')`」的顺序解码。BOM 会被剥掉，与 `FileReader.readAsText` 的既有行为一致；非 UTF-8 / UTF-16 只读预览并明确提示。

**UI 复用**：抽屉刻意带上 `.outline-panel` 类——浮层骨架、`.show` 切换、**打印时隐藏**三件事都由那一套既有规则承担，`.file-tree-panel` 只把它从「右侧居中浮层」改成「左侧通栏抽屉」（毛玻璃 + 宽度拖拽，宽度记在 `mdtu-tree-width`）。文件行会占住折叠箭头那一列（空槽），否则同级目录与文件的图标 / 文字会左右错开。

**抽屉头部不再单占一行标题。** 早先的版本是 `.outline-header`「文件树…」+ 下面一行工作区名，两行都占地方，字号还和树内容不一致。现在头部只有一个 `.tree-head`：左边 `.tree-root`（工作区名，14px / 600 粗）+ `.tree-mode`（快照模式标签），右边 `.tree-head-actions` 里四个 28×28 的 `.tree-btn`（图标 16×16：全部展开 / 全部收起 / 换文件夹 / **收起**）。最后一个刻意**不用 `×`**，而是「面板 + 左向箭头」——`×` 在这个位置会被读成「关闭 / 删除」，可它做的只是把抽屉折回边缘，不是关掉工作区。**全树字号统一 14px**：`.tree-head` / `.tree-root` / `.tree-mode` / `.tree-row` / `.tree-note` / `.tree-empty` / `.tree-pick` 同一档，不再有大有小；树内图标同步放大（`ICON_CARET` 12 / `ICON_DIR` 15 / `ICON_FILE` 14），折叠箭头槽 14px、图标槽 16px、缩进步长 `depth * 15`——**字号、槽宽、步长是联动量，改一个要跟着改另外两个**，否则同级目录与文件的图标会重新错开。没有工作区时三个操作按钮 `hidden`（`.tree-btn[hidden]{display:none!important}`）。

**抽屉的显示 / 隐藏有三条路，各司其职。** ① 顶栏「打开 → 文件夹」那一项本身就是**开关**（展开时带 `.active` 激活态）；② 抽屉头部的「收起」按钮把它折回边缘；③ **抽屉收起后，留一枚悬浮球 `.tree-peek`**——`position: fixed`、`z-index: 790`，44×44 正圆、**实心 `--accent` 蓝底 + 白图标**、带投影（实心色 + 投影 = 一眼看出「这是个能点、能挪的东西」；浅底在白色正文上几乎化进背景，所以不用浅底）。按下时切 `.pressing` → `--accent-press`（`#f97316` 橙），给一个「按到了」的反馈；**这里不能用 `:active`**——`pointerdown` 里调了 `preventDefault()`，浏览器不再派发 `mousedown`，`:active` 未必成立，所以由 JS 显式加/摘 class，颜色才可控、可测。它用**指针事件**实现拖动：`pointerdown` 记起点、`pointermove` 写内联 `left/top`（`place()` 把坐标钳在视口内）、`pointerup` 落库；**位移小于 `PEEK_DRAG_SLOP`（4px）才算一次点击**，只有点击才展开抽屉——否则每次把球挪开都会顺手把文件树弹出来。位移一旦过阈值就摘掉 `.pressing`，于是**「点击 = 橙、拖动 = 蓝」在颜色上也能分辨**。位置存 `mdtu-tree-peek-pos`，`resize` 时重新钳制一次，免得窗口变小后球被留在视口外。第 ③ 条只在「**已经打开过工作区 + 抽屉处于收起**」时露出——还没选过目录时那个位置就空着（入口在顶栏菜单里，不需要第二个）。这条是为了把「隐藏之后怎么找回来」变成一个一眼可见、还能随手挪开的动作，而不是让人记得去菜单里翻。⚠️ 橙色只在**按下那一瞬**可见：球在 `pointerup` 后随抽屉展开一起隐藏，它不是一个残留状态。

**「全部展开 / 全部收起」是两件不同的事。** 收起只是 `treeState.expanded.clear()`（清空展开集合，树的 `children` 留着，重新展开不必再读盘）。展开则要**逐个目录读盘**——懒加载的树一旦全展开，等于把整棵目录树读进内存，几千文件的目录会直接拖死 UI，所以 `TREE_EXPAND_MAX = 400` 封顶：到顶就停手并 `showToast('目录较多，只展开了前 400 个')`，而不是假装展完了。读盘过程中每 20 个目录重绘一次（每个都重绘会把整趟遍历拖慢一个量级），并用 `treeExpanding` 防止重复点击叠加。

**打开成功不弹 Toast。** 正文已经换掉了，再盖一层浮层只是碍事——这条同时适用于单文件打开与树里切换文档。**只有一种例外**：非 UTF-8（GBK 回退）/ UTF-16 解码时必须提示，因为那时眼前的内容不是原文件字节的忠实还原，而且只读。

---

## 8. 主题体系

2 套文章主题，通过预览容器上的 `theme-*` class 切换（与 `device-*` / `grid-bg` 一起由 `syncPreviewClass()` 统一拼装，见 7.9），样式集中在 `style.css`：

| 主题 | class | 风格 |
|------|-------|------|
| GitHub | `theme-github` | 经典 GitHub 排版（默认） |
| 晴空蓝 | `theme-qingkong` | `#66CCFF` 晴空蓝点缀、居中标头、浅蓝引用块 |

> 2026-10-13 前为 4 套（另有「山吹 / 山月 / 凝夜紫」）。精简为 2 套时，「山吹」复用了原有 CSS 变量改名为「晴空蓝」，另两套整段删除。老用户 localStorage 里的旧值由 `THEME_ALIASES`（app.js:11）+ `normalizeTheme()`（app.js:18）收敛：`shanchui → qingkong`、`shanyue / condensed-night-purple → github`，不会落到空主题。

**共用排版基线。** 每套主题各自声明引用块（`blockquote`）的边框、底色与内边距，但「引用内首/末子元素外边距归零」这条写在主题区之外，由两条共用规则统一处理：

```css
.markdown-body blockquote > :first-child { margin-top: 0; }
.markdown-body blockquote > :last-child  { margin-bottom: 0; }
```

设计意图有两层，缺任一层都会让「多行 `>` 引用」看起来丢格式：

1. **末子元素必须归零**——晴空蓝的引用块自带上下 `padding`，末元素（段落、代码块、列表）若保留自身下外边距，框内会多出一段空白（实测 24–26px）。
2. **中间段落不能归零**——GitHub 官网只清首尾，段与段之间靠 `p` 自身的 `margin` 分段。早期实现写成 `blockquote p { margin: 0 }`，多段引用（`> 甲` + `>` + `> 乙`）实测段间距为 `0px`，两段粘成一坨。

同理，引用块的**次要文字色**（GitHub 的 `#57606a` 等）只声明在 `blockquote p` / `blockquote li` 上，不声明在 `blockquote` 本体：声明在本体会被引用内的 `h1–h6` 继承，标题一起变灰、层级感消失。这两条约束在 `style.css` 与 `getThemeStyles()` 里必须同步，回归测试 `bq-test.js` 的 A 段会做静态断言。

**换行语义。** `marked.setOptions({ breaks: true })`——源码中单个换行渲染为 `<br>`，与 GFM 默认的「折成空格」不同。取舍理由：本工具面向公众号排版，中文作者习惯一行一句、且不做硬换行；同类的 [doocs/md](https://github.com/doocs/md)（同样基于 marked）也是 `breaks: true`。代价是英文硬换行的段落会按折行位置断行，全文仅在 `js/app.js:307` 一处可切回 `false`。该语义对引用块与普通段落一致，没有做分叉。

复制到公众号时，另有一套内联样式 `getThemeStyles(theme)`（app.js:1002），用于把主题样式随富文本一起带出（与 style.css 的主题类平行维护）。

> 第 3 份平行维护的是**元数据配色** `FM_PALETTE`（app.js:341，另含图标路径表 `FM_ICON_PATHS`）：它不走 `getThemeStyles()`，而是把颜色直接写进元数据面板的内联 style，原因见 7.7。

> 主题选择器此前在 `index.html` 中被 `style="display:none;"` 隐藏、锁定 GitHub 主题；**2026-10-13 起放开**（删掉 `#themeSelect` 所在 `.toolbar-group` 与其后 `.toolbar-divider` 上的 `display:none`，逻辑未动），并同轮**精简为 2 套**（GitHub / 晴空蓝）。删主题需**四处同步**：`style.css` 的 `.theme-*`、`getThemeStyles()`、`FM_PALETTE`、以及 `index.html` 的 `<option>`；旧值收敛表 `THEME_ALIASES` 另行维护。外部主题生态的调研结论见 [F3-THEME-RESEARCH.md](./F3-THEME-RESEARCH.md)。

---

## 9. 数据存储

全部存浏览器 localStorage，无任何服务端：

| Key | 内容 |
|-----|------|
| `mdtu-content` | 编辑正文 |
| `mdtu-theme` | 当前主题 |
| `mdtu-templates` | 自定义模板（JSON 数组） |
| `mdtu-watermark` | 水印配置（JSON） |
| `mdtu-fs-width` | 全屏页宽 |
| `mdtu-device` | 预览设备档（`pc` / `ipad` / `app`） |
| `mdtu-tree-width` | 文件树抽屉宽度（180–640px） |
| `mdtu-tree-peek-pos` | 收起后悬浮球的位置（JSON `{ x, y }`，视口内钳制） |
| `mdtu-frontmatter` | 元数据展示方式（`panel` / `codeBlock` / `hide`，旧值 `table` 读取时自动迁移） |

> 早先还有一个 `mdtu-platform`（展示端）。平台维度并入设备档后，`init()` 会主动把它从 localStorage 里 `removeItem` 清掉。

---

## 10. 已知限制与风险

| # | 限制 | 说明 |
|---|------|------|
| 1 | 导出 PDF 的文字不可选中 | 「导出 PDF」确实一键下载（`html2canvas` + `jsPDF`），但内容是**图片**——文字不可选中、不可检索，体积也比矢量版大。要可检索的 PDF 请改用**「打印」**（矢量、文字可选）并在打印对话框里选「另存为 PDF」。导出 Word 是 `application/msword` 的 `.doc` **HTML 套壳**而非真 `.docx`，部分客户端会弹格式兼容提示，且不带水印。导出 **HTML 是完全自包含**的（样式全内联、断网可打开） |
| 2 | 「打开」只读 | 读取后编辑不写回磁盘 |
| 3 | URL 采集依赖代理 | 走 `api.allorigins.win` CORS 转发，不稳定且可能抓取不全 |
| 4 | 离线不可用 | 依赖全走 CDN，无网络渲染链路瘫痪 |
| 5 | 水印在公众号不保证生效 | DOM 节点方案提高存活率，微信仍可能二次过滤 |
| 6 | 主题入口 | 曾长期被 `display:none` 隐藏、锁定 GitHub；**2026-10-13 起放开并精简为 2 套**（GitHub / 晴空蓝），见第 8 节 |
| 7 | 无移动端适配 | 分屏布局面向桌面；设备档预览（iPad / APP）只模拟**目标输出**的版心与字号，并非编辑器自身的响应式布局 |
| 8 | 复制主题样式有剥离风险 | 微信会过滤 `<style>` 标签，需内联 style 才能根治（见 F3）。元数据面板已改用内联样式，不受此影响 |
| 9 | 元数据面板的复制效果待人工确认 | 面板与标签全部走内联样式，但公众号编辑器的实际保留情况只能在真实后台验证（见 ROADMAP 的 F4 验收标准 8） |
| 10 | `breaks: true` 会把硬换行当换行 | 与 GFM 默认语义不同：英文段落若按 80 列硬换行，渲染时会按折行位置断行。这是为公众号中文写作场景做的取舍（见第 8 节），需要时改 `js/app.js:307` 一处即可切回 |
| 11 | 超长文档的「导出 PDF」会主动拒绝 | `html2canvas` 要一次性光栅化整篇内容，受浏览器画布面积上限约束。`scale` 会依次降 2 → 1.5 → 1 让步，仍放不下时**明确提示改走「打印」**，不会交出被截断的 PDF |

---

## 11. 未来规划

规划详见 [ROADMAP.md](./ROADMAP.md)，清单式摘要如下：

| 编号 | 模块 | 优先级 | 状态 | 说明 |
|------|------|--------|------|------|
| **F1** | 导出能力 | P0 | ✅ 已完成 | 复制 MD / 导出 HTML / 导出 PDF（下载）/ 导出 Word / 打印，一站到位（见 7.8） |
| **F2** | 界面与交互优化 | P1 | ⬜ 待规划 | 字体排版 / 交互效率 / 提示反馈 / 无障碍 / 响应式 |
| **F3** | 主题模板体系 | P1 | 🟦 部分落地 | 已精简为 2 套自研主题（GitHub / 晴空蓝）+ 旧值收敛；外部主题生态调研见 [F3-THEME-RESEARCH.md](./F3-THEME-RESEARCH.md)，结论是「先把 2 套做扎实」、推荐自研 token→CSS 生成器（见 7.9 相关的平行维护问题） |
| **F4** | 文档元数据解析与展示 | P1 | ✅ 已完成 | YAML Front Matter → 顶部「属性」面板（类型图标 + 标签样式）+ 三档展示（见 7.7） |
| **F5** | 文件夹模式 | P1 | 🟦 部分落地 | **F5-a（只读）已完成**：打开文件夹 + 文件树 + 切换文档 + 三层能力降级（见 7.10）；写回 / 文件管理 / 冲突检测未做，方案见 [F5-FOLDER-MODE.md](./F5-FOLDER-MODE.md) |
| **F6** | 预览模式（设备档） | P1 | ✅ 已完成 | 设备档（PC / iPad / APP）平铺档位，每档内建对应阅读场景（Web / Web + 平板适配 / 公众号），只影响预览、不进产物（见 7.9） |

**共同前置约束**：项目是「零构建 + CDN」纯静态三文件，新增依赖要么走 CDN `<script>`，要么引入构建步骤并改变「双击即跑」的性质。

---

## 附：二次开发要点（易踩坑）

- **marked 版本**：锁 v4，勿随手升级（`renderer.link` API 变更）。
- **滚动容器**：真正的滚动容器是 `#previewWrap`，滚动监听绑错会静默失效。
- **大纲跳转**：跳转期间调用 `suppressSync(600)` 关闭双向同步，避免两栏拉扯。
- **水印双路径**：`buildWatermarkUrl()`（预览）与 `injectWatermarkNodes()`（复制）需同步维护。
- **元数据的剥离时机**：`splitFrontMatter()` 必须在 `marked.parse()` 之前调用，否则元数据会被渲染成 `<hr>` + 一个吞掉全部元数据的假 `<h2>`。
- **js-yaml 的 schema**：解析元数据必须传 `CORE_SCHEMA`，默认 schema 会把 `date: 2026-09-20` 变成 `Date` 对象（东八区显示成前一天）。
- **导出样式平行**：导出 HTML / Word 用的外壳样式（`EXPORT_PAGE_CSS`，app.js:1049；`WORD_COMPAT_CSS`，app.js:1064）与 `getThemeStyles()`、`style.css` 的主题类构成第 4 处平行——改主题色时同样要顾及（详见 7.8）。
- **元数据配色三处平行**：`FM_PALETTE`（内联样式，app.js:341）、`getThemeStyles()`（复制用内联样式，app.js:1002）、`style.css` 的 `.theme-*`——改主题色时都要顾及。
- **DOM 结构约束**：`js/app.js` 通过 `$('#id')` 取元素，改 HTML 需保持 id 不变或同步改 JS。
- **引用块样式两条禁令**：不得写 `blockquote p { margin: 0 }`（多段引用会粘死，段间距实测 0px）；不得把次要文字色声明在 `blockquote` 本体上（引用内 `h1–h6` 会被一起染灰）。首/末子元素归零由 `.markdown-body blockquote > :first-child / :last-child` 两条共用规则统一处理——详见第 8 节。
- **复制路径要跟着改**：`getThemeStyles()` 里的样式字符串与 `style.css` 的主题类平行维护，改一处必须改两处；`bq-test.js` 的 A 段会对两边同时做静态断言。
- **本文与 ROADMAP 里的 `app.js:NNN` 行号会随代码增长漂移**：改完代码后请用 `grep -n` 复核，或直接用函数名定位（每次改动 `app.js` 后至少会漂一次，历史上已发生多轮）。
- **导出相关的三个连带点**：① 主题色有 4 处平行（`style.css` 的 `.theme-*`、`getThemeStyles()`、`FM_PALETTE`、导出外壳 `EXPORT_PAGE_CSS` / `WORD_COMPAT_CSS`）；② 把 CDN CSS 文本内联进导出文件前必须绝对化其中的 `url()`，否则 KaTeX 的 `@font-face` 全部 404；③ 块级公式能否渲染取决于 `renderMath()` 开头的 `unfoldDisplayMath()` 有没有把 `breaks: true` 造出来的 `<br>` 合回文本节点，动这块时别漏。
- **预览容器的 class 只有一个出口**：`preview.className` 一律经 `syncPreviewClass()`（app.js:854）拼装（主题 + 方格 + 设备档三维）。全文只允许一处写 `preview.className = [`，别处整串覆盖会静默冲掉其余维度；`device-*` 是观察工具，**进产物前必须在两条克隆路径上剥掉**（`stripPreviewModeClasses()`，app.js:931）。
- **设备档的选择器要写两级**：`.markdown-body.device-app` 而非 `.device-app`——主题段 `.theme-*` 同样声明 `font-size`，且排在设备档之后，单级选择器会被顶掉。详见 7.9。
