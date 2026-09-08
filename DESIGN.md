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
├── index.html        # 页面结构 + CDN 依赖引入（约 372 行）
├── css/
│   └── style.css     # 全部样式：4 套主题 + 布局 + 弹窗 + 水印（约 1178 行）
├── js/
│   └── app.js        # 全部逻辑：解析/渲染/大纲/水印/模板/复制（约 1510 行）
├── README.md         # 项目说明（GitHub 标准格式）
├── ROADMAP.md        # 未来功能升级路线（独立文档）
├── DESIGN.md         # 本文档
├── LICENSE           # MIT
└── .gitignore
```

无任何构建产物，无 `node_modules`。

### 3.2 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  表现层  index.html（DOM 结构，JS 通过 $() 按 id 取元素）  │
├─────────────────────────────────────────────────────────┤
│  样式层  style.css（布局 + 组件 + 4 套文章主题 + 水印）     │
├─────────────────────────────────────────────────────────┤
│  逻辑层  app.js（IIFE 单文件，模块化函数组织）             │
│    ├─ 状态管理    state 对象 + localStorage 持久化        │
│    ├─ 渲染管线    marked → DOMPurify → 后处理            │
│    ├─ 交互层      事件监听 / 工具栏 / 快捷键 / 弹窗         │
│    └─ 数据层      localStorage 读写封装                    │
├─────────────────────────────────────────────────────────┤
│  依赖层  CDN：marked / highlight.js / KaTeX / Mermaid /   │
│         DOMPurify（jsDelivr 引入）                        │
└─────────────────────────────────────────────────────────┘
```

### 3.3 核心数据流（渲染管线）

```
编辑器文本(textarea)
      │
      ▼
marked.parse(md)          ← 自定义 renderer.link（外链转脚注）
      │
      ▼
DOMPurify.sanitize()      ← 防 XSS，白名单标签/属性
      │
      ▼
applyAutoNumbering()      ← 可选：H1–H3 自动编号
      │
      ▼
preview.innerHTML = html  ← 写入预览区
      │
      ├─→ 追加参考文献区块（外链脚注模式）
      ├─→ renderMermaidFromDOM()   ← 异步渲染 Mermaid 为 SVG
      ├─→ renderMath()             ← KaTeX auto-render
      ├─→ updateCounts()           ← 字符/词/行统计
      └─→ updateOutline()          ← 大纲实时更新
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

> ⚠️ **marked 版本约束**：项目锁 v4。v12 的 `renderer.link` 签名与 v4 不兼容，升级会导致「外链转脚注」失效，改动前必须先确认 API 差异。

---

## 5. 界面布局设计

### 5.1 三段式顶栏（`.app-header`，高 56px）

| 区域 | 内容 |
|------|------|
| 左侧 `.header-left` | Logo：`📝 Markdown-Editor` |
| 中间 `.header-center` | 主题切换（**默认隐藏**）、大纲、自动编号、插入目录、方格背景、使用模板、水印 |
| 右侧 `.header-right` | 打开文件、更多工具、外链转脚注、**复制（primary 主按钮）** |

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
- **预览面板**：预览工具栏（同步滚动、全屏、全屏页宽控件）→ `.preview-wrap`（真正的滚动容器）→ `.markdown-body`（渲染正文）。
- **分隔条 `.resizer`**：可拖拽调整两栏比例（`mousedown/mousemove/mouseup`，15%–85% 范围限制）。

### 5.3 弹窗组件

| 弹窗 | 尺寸 | 用途 |
|------|------|------|
| `#templateModal` | 720px | 模板管理（列表 + 编辑器） |
| `#urlModal` | 460px (modal-sm) | URL 链接采集 |
| `#linksModal` | 760px (modal-lg) | 工具/开源项目导航（三 Tab） |
| `#watermarkModal` | 680px (modal-md) | 水印设置（左表单 + 右预览） |

另有悬浮组件：文档大纲 `.outline-panel`（右侧垂直居中悬浮）、Toast 提示 `.toast`。

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
| 全屏预览 | 预览区全屏 + Esc 退出 |
| 页宽调节 | 窄 680 / 中 880 / 宽 1100 / 超宽 1400 / 全屏宽（纸张感） |
| 自动编号 | H1–H3 多级编号 |
| 插入目录 | 自动生成 TOC |
| 方格背景 | 便于截图对齐 |
| 打开文件 | 读本地 `.md/.markdown/.txt/.mdx` |
| URL 采集 | 输入网址抓正文转 Markdown |
| 更多工具 | 内置同类工具与开源项目导航（三 Tab） |
| 主题 | 4 套文章主题（见第 8 节） |

### 6.4 持久化

编辑内容自动写入 localStorage，刷新不丢；模板、水印配置、主题、页宽同样本地化存储。

---

## 7. 关键实现机制

### 7.1 渲染管线（`renderMarkdown()`，app.js:305）

按固定顺序执行：`marked.parse` → `DOMPurify.sanitize`（白名单：`ADD_TAGS` 含 sup/sub/span/div 等，`ADD_ATTR` 含 class/style/id/href 等）→ 自动编号 → 写 DOM → 后处理（脚注/图表/公式/统计/大纲）。

### 7.2 外链转脚注（`renderer.link`，app.js:258）

重写 marked 的 `renderer.link`：当 `state.footnoteLinks` 开启且 href 为 http(s) 时，用计数器生成上标 `[n]`，并把链接收进 `footnoteList`，渲染完成后在文末追加 `.footnote-section` 参考文献区块。

### 7.3 水印双路径渲染（微信兼容性关键）

| 路径 | 函数 | 机制 | 原因 |
|------|------|------|------|
| 预览 | `buildWatermarkUrl()` | 生成 SVG data URI 作 CSS 平铺背景 | 性能好、不污染 DOM |
| 复制 | `injectWatermarkNodes()` | 绝对定位 `<span>` 平铺铺满容器 | 微信会过滤 SVG data URI 背景，DOM 节点粘贴后更易存活 |

### 7.4 富文本复制（`copyToClipboard()`，app.js:574）

克隆预览 → 清空背景 → 注入 `getThemeStyles(theme)` 的 `<style>` 块 → 注入 DOM 水印 → `Range` 选区 + `execCommand('copy')`，失败则降级为纯文本复制。用废弃但兼容性最好的 `execCommand` 实现富文本复制。

### 7.5 大纲双向联动（app.js:959–1110）

- `getSourceHeadings()`：扫描源码 ATX 标题（跳过围栏代码块）记录行号。
- `buildOutline()`：把预览区 `<h1..h6>` 通过「层级 + 归一化文本」匹配回源码行号。
- 点击跳转：编辑器用镜像 div 测量行偏移后平滑滚动；预览区用 `getBoundingClientRect` 差值滚动。
- `suppressSync(600)`：跳转期间临时关闭双向同步，避免两栏互相拉扯。

### 7.6 同步滚动（app.js:767–778）

编辑区与预览区滚动事件互相映射，按 `scrollTop / (scrollHeight - clientHeight)` 比例同步；`syncBlocked()` 判断抑制窗口。**真正的滚动容器是 `#previewWrap`**（`overflow:auto` 在它身上），不是 `#previewScroll`。

---

## 8. 主题体系

4 套文章主题，通过 `preview.className = markdown-body theme-*` 切换，样式集中在 `style.css`：

| 主题 | class | 风格 |
|------|-------|------|
| GitHub | `theme-github` | 经典 GitHub 排版（默认） |
| 山吹 | `theme-shanchui` | 蓝色点缀、居中标头、暖色系 |
| 山月 | `theme-shanyue` | 绿色点缀、极简清新 |
| 凝夜紫 | `theme-condensed-night-purple` | 紫色暗色系 |

复制到公众号时，另有一套内联样式 `getThemeStyles(theme)`（app.js:644），用于把主题样式随富文本一起带出（与 style.css 的主题类平行维护）。

> 主题选择器当前在 `index.html` 中被 `display:none` 隐藏，默认锁定 GitHub 主题。

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

---

## 10. 已知限制与风险

| # | 限制 | 说明 |
|---|------|------|
| 1 | 无导出功能 | 内容只在 localStorage，无 `.md/.html/PDF` 出口 |
| 2 | 「打开」只读 | 读取后编辑不写回磁盘 |
| 3 | URL 采集依赖代理 | 走 `api.allorigins.win` CORS 转发，不稳定且可能抓取不全 |
| 4 | 离线不可用 | 依赖全走 CDN，无网络渲染链路瘫痪 |
| 5 | 水印在公众号不保证生效 | DOM 节点方案提高存活率，微信仍可能二次过滤 |
| 6 | 主题入口隐藏 | 默认锁定 GitHub 主题 |
| 7 | 无移动端适配 | 分屏布局面向桌面 |
| 8 | 复制主题样式有剥离风险 | 微信会过滤 `<style>` 标签，需内联 style 才能根治（见 F3） |

---

## 11. 未来规划

规划详见 [ROADMAP.md](./ROADMAP.md)，清单式摘要如下：

| 编号 | 模块 | 优先级 | 状态 | 说明 |
|------|------|--------|------|------|
| **F1** | 导出能力 | P0 | ⬜ 待规划 | 复制 MD / 导出 PDF / Word / HTML，全部浏览器下载 |
| **F2** | 界面与交互优化 | P1 | ⬜ 待规划 | 字体排版 / 交互效率 / 提示反馈 / 无障碍 / 响应式 |
| **F3** | 主题模板体系 | P1 | ⬜ 待规划 | 可切换主题模板，支持复制到公众号（需先重构渲染管线为内联 style） |

**共同前置约束**：项目是「零构建 + CDN」纯静态三文件，新增依赖要么走 CDN `<script>`，要么引入构建步骤并改变「双击即跑」的性质。

---

## 附：二次开发要点（易踩坑）

- **marked 版本**：锁 v4，勿随手升级（`renderer.link` API 变更）。
- **滚动容器**：真正的滚动容器是 `#previewWrap`，滚动监听绑错会静默失效。
- **大纲跳转**：跳转期间调用 `suppressSync(600)` 关闭双向同步，避免两栏拉扯。
- **水印双路径**：`buildWatermarkUrl()`（预览）与 `injectWatermarkNodes()`（复制）需同步维护。
- **DOM 结构约束**：`js/app.js` 通过 `$('#id')` 取元素，改 HTML 需保持 id 不变或同步改 JS。
