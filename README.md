# markdown-editor

给**微信公众号**写稿用的 Markdown 编辑器：左边写、右边看，一键复制成能直接粘进公众号后台的富文本。

纯静态三文件，零构建、零依赖，起个本地服务就能用。

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build](https://img.shields.io/badge/build-none-brightgreen.svg)
![Dependencies](https://img.shields.io/badge/dependencies-CDN%20only-orange.svg)

---

## 特性

**编辑**

- 分屏实时预览，分隔条可拖拽；双向同步滚动（可关）
- 代码高亮（highlight.js）、数学公式（KaTeX）、Mermaid 图表（点击可全屏缩放、拖动、双击复位）
- 单行换行即换行（`breaks: true`，与 doocs/md 一致）
- 2 套主题：GitHub / 晴空蓝
- 全屏预览（窄/中/宽/超宽/铺满五档页宽）、全屏编辑（专注写作，860px 版心）

**公众号排版**

- 一键复制渲染结果，样式与代码高亮一并保留
- 外链转脚注：正文链接变上标序号，文末生成「参考文献」
- 水印：文字、颜色、字号、透明度、角度、间距可调，预览与复制同步生效
- 模板：用 `{{ content }}` 占位预置头尾，一键套用
- 设备档预览：PC（820px）/ iPad（768px）/ APP（375px，公众号字号 17px、行高 1.75），**只影响预览，不进产物**
- 目录大纲：右侧悬浮面板，源码与预览双栏联动跳转
- 文档元数据：自动识别 YAML Front Matter，渲染为 Obsidian 风格「属性」面板（三档：属性 / 源码 / 隐藏）

**导出**

| 动作 | 产物 | 说明 |
|------|------|------|
| 复制 Markdown | 剪贴板 | 源码原文 |
| 导出 HTML | `.html` | 单文件、样式全内联，断网可打开 |
| 导出 PDF | `.pdf` | 预览转图片按 A4 切片，**文字不可选中** |
| 导出 Word | `.doc` | HTML 套壳，不带水印 |
| 打印 | 打印对话框 | 矢量、文字可选中，可另存为 PDF |

全部在浏览器本地完成，不经过任何服务端。文件名取元数据 `title` → 首个 H1 → `document`。

**本地文件（只读）**

- 打开单个文件，或整个文件夹：左侧文件树、懒加载、只列 Markdown、数字感知排序（`第2章` 在 `第10章` 前）
- 头部「刷新」可重读磁盘与当前正文；有未保存改动时先确认再覆盖
- 编码：UTF-8 / UTF-8 BOM / UTF-16 正常读入，非 UTF-8 按 GBK 只读预览并提示
- PWA 安装后 `.md` 进入系统「打开方式」，双击直达编辑器

**其他**

- 编辑内容自动存 localStorage，刷新不丢
- URL 采集：输入网址抓正文转 Markdown，先直连、被跨域挡住才走转发通道，抓不到正文不动原稿
- 标题自动编号、一键插入目录（`<!-- TOC -->` 标记 + 渲染时派生）、方格背景

---

## 快速开始

```bash
cd markdown-editor
python -m http.server 20001   # 或：npx serve . -l 20001
```

打开 <http://localhost:20001>。也可直接双击 `index.html`（`file://` 下部分浏览器限制 localStorage，且**装不成应用**）。

**要装成应用（让 `.md` 双击直达编辑器）**：走本地服务或[线上地址](https://justwithyou.github.io/markdown-editor/)，用 Edge / Chrome 打开，点地址栏右侧安装图标。装完是独立窗口，`.md` 会出现在「打开方式」里，设成默认即可双击打开。仅 Chromium 系桌面浏览器支持。

**环境要求**：现代浏览器 + 联网（marked、highlight.js、KaTeX、Mermaid、DOMPurify、js-yaml 走 jsDelivr CDN）。

---

## 使用说明

### 编辑与预览

顶部工具栏有 18 个语法插入按钮：文本（粗体/斜体/删除线）、标题（H1–H3）、插入（链接/图片/行内代码/代码块）、列表（无序/有序/任务/引用）、块级（分割线/表格/公式/Mermaid）；右侧另有 URL 采集、全屏编辑、清空。

引用块支持嵌套与多段，外边距按 GitHub 的规则处理（只把首末子元素归零，中间段落保留段距）。

### 复制到公众号

点右上角**「复制」**（带微信标识），渲染结果以富文本写入剪贴板，直接粘贴进公众号编辑器即可。

### 导出

点顶栏**「导出」**展开菜单，五个动作见上方表格。

- **「导出 PDF」≠「打印」**：前者把预览光栅化后装进 PDF，点一下直接下载，代价是文字变图片；后者走浏览器打印管线，矢量、可检索，在对话框里选「另存为 PDF」。超长文档撞上画布上限时会明确提示改用「打印」，不会给出截断文件。
- 导出 HTML / Word 会以注释形式保留 YAML 元数据原文；导出的 HTML 里图片仍是原链接。

### 预览模式（设备档）

预览工具栏左侧 **PC / iPad / APP** 平铺，点一下就切，选择记入 `mdtu-device`。

- **PC**：Web 原貌，版心上限 820px
- **iPad**：768px，正文放大、行距放宽
- **APP**：375px + 公众号度量（17px / 行高 1.75 / 字距 +0.5px），长代码行硬折行——提前暴露微信正文不支持横向滚动的问题

设备档类在复制 / 导出前会被剥掉，不会混进产物。

### 外链转脚注

点顶部**「外链转脚注」**开启。`[Google](https://google.com)` 会渲染成「Google」加一个上标序号 `[1]`，文末自动生成「参考文献」区块，用于绕开公众号正文不支持外链跳转的限制。

### 水印与模板

- **水印**：点顶部「水印」打开面板，左调参右预览，可勾选「复制时带上水印」。只作用于预览与复制结果，不改源码。
- **模板**：点「使用模板」→ 新建，用 `{{ content }}` 标记正文插入位置 → 应用。模板存 localStorage。

### 目录大纲与全屏

- **大纲**：右侧悬浮面板，扫描 H1–H6，点击时编辑器与预览同步滚动；头部 `›` 收起为右缘悬浮球（不是关闭），`×` 才是关闭。
- **全屏预览**：预览区右上角图标，进去后锁定当前设备档，页宽控件仅在 PC 档出现。
- **全屏编辑**：编辑工具栏最右侧「四角」按钮，只留编辑器，`Esc` 退出。与全屏预览**互斥**，两者都不记档，刷新即恢复普通双栏。

### 打开本地文件 / 文件夹

点顶栏**「打开」**→「文件」或「文件夹」。

- **文件**：`.md` / `.markdown` / `.mdx` / `.txt`，UTF-8 读入；已有内容时先确认。这是读取动作，编辑不会写回磁盘。
- **文件夹**（Chromium 系）：左侧滑出文件树抽屉，点节点即切换文档，主题、大纲、字数、元数据面板全部自动跟随。只列 Markdown 文档，整棵没有 Markdown 的目录不显示。
  - 抽屉高度为视口 2/3、垂直居中悬浮，宽度可拖；头部即工作区名（展开 / 收起 / 刷新 / 换文件夹 / 收起）
  - 收起后留一枚可拖动的蓝色悬浮球，点它拉回抽屉；球右上角 `×` 才是真关闭（收起 ≠ 关闭）
  - **全部展开**上限 400 个目录，到顶停手并告知
  - 三层降级：File System Access API → `webkitdirectory` 只读快照 → 入口不渲染（Firefox / Safari 只留「文件」）

### 文档元数据

文件首部有 YAML Front Matter 时自动剥离，在预览顶部渲染为「属性」面板：类型图标 + 键 + 值，嵌套对象逐层展开，`tags` 渲染为胶囊标签，日期不做时区转换。

三档展示（属性 / 源码 / 隐藏）仅在检测到元数据时出现。元数据不计入字数统计、不进大纲、不参与标题编号，**源码一字不动**。

---

## 快捷键

| 快捷键 | 功能 | 快捷键 | 功能 |
|--------|------|--------|------|
| `Ctrl/⌘ + B` | 粗体 | `Ctrl/⌘ + Shift + U` | 无序列表 |
| `Ctrl/⌘ + I` | 斜体 | `Ctrl/⌘ + Shift + O` | 有序列表 |
| `Ctrl/⌘ + K` | 插入链接 | `Ctrl/⌘ + S` | 保存到 localStorage |
| `Ctrl/⌘ + Shift + K` | 行内代码 | `Tab` | 缩进两个空格 |
| `Ctrl/⌘ + Shift + C` | 代码块 | `Esc` | 退出全屏 |

---

## 项目结构

```
markdown-editor/
├── index.html        # 页面结构 + CDN 引入 + 图标与 manifest 声明（506 行）
├── css/style.css     # 全部样式，含 2 套主题与打印样式（2070 行）
├── js/app.js         # 全部逻辑：渲染、复制、导出、文件树、大纲等（4080 行）
├── Markdown.ico      # 图标源文件（六帧 16–256），页头与标签页共用
├── icon-192.png      # PWA 图标，由 Markdown.ico 派生
├── icon-512.png      #   同上
├── manifest.json     # PWA 清单 + file_handlers（.md 文件关联）
├── LICENSE
├── DESIGN.md         # 设计文档：架构、渲染管线、各模块实现细节
├── ROADMAP.md        # 功能规划与实测记录
└── F5-FOLDER-MODE.md # 文件夹模式专项方案（另有 F3-THEME-RESEARCH.md）
```

无构建产物，无 `package.json`。图标只有 `Markdown.ico` 一份是源，两份 PNG 由它派生（替换 ico 后重跑 `tools/make-icons.js`）。

---

## 技术栈

| 库 | 版本 | 用途 |
|----|------|------|
| [marked](https://github.com/markedjs/marked) | 4.3.0 | Markdown 解析 |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 11.9.0 | 代码高亮 |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 0.16.9 | 数学公式 |
| [Mermaid](https://github.com/mermaid-js/mermaid) | 10.9.0 | 图表 |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.1.6 | HTML 消毒 |
| [js-yaml](https://github.com/nodeca/js-yaml) | 4.1.0 | Front Matter 解析 |

> **marked 锁 v4**：v12 的 renderer API 不兼容，升级会让外链转脚注等功能失效。

---

## 数据存储

全部在 localStorage，不上传服务器：

| Key | 内容 |
|-----|------|
| `mdtu-content` | 正文 |
| `mdtu-theme` | 主题 |
| `mdtu-templates` | 自定义模板 |
| `mdtu-watermark` | 水印配置 |
| `mdtu-device` | 设备档 |
| `mdtu-fs-width` | 全屏页宽 |
| `mdtu-frontmatter` | 元数据展示方式 |
| `mdtu-tree-width` | 文件树抽屉宽度 |
| `mdtu-tree-peek-pos` | 收起后悬浮球位置 |

---

## 已知限制

1. **导出 PDF 的文字不可选中 / 检索**（内容被光栅化成图片）；要可检索的 PDF 请用「打印」另存。导出 Word 是 `.doc` HTML 套壳，部分客户端会提示格式兼容。
2. **本地文件只读**：打开文件或文件夹后，编辑结果只存 localStorage，不写回磁盘（`Ctrl+S` 也不等于存盘）。
3. **URL 采集受 CORS 限制**：能直连的静态站照常抓；被跨域挡住的站点需要能出境的网络（三条转发通道均在境外）。失败会明确报因且不动原稿。
4. **离线不可用**：依赖全走 CDN；装成 PWA 也不离线可用（未注册 Service Worker）。
5. **水印不保证在公众号生效**，微信可能二次过滤样式，粘贴后请确认。
6. **无移动端适配**：分屏布局面向桌面，设备档只模拟输出效果，不是编辑器自身的响应式。

更多取舍与理由见 [DESIGN.md §10](./DESIGN.md#10-已知限制与风险)。

---

## FAQ

**内容会丢吗？** 换浏览器、清缓存、无痕模式都会丢 localStorage。重要内容请手动复制备份。

**主题在哪切？** 顶栏中段、「大纲」左侧，共 2 套（GitHub / 晴空蓝）。旧存档里的历史主题名会自动收敛。

**渲染卡住 / 一片空白？** 先确认能访问 `cdn.jsdelivr.net`，依赖加载失败会导致整条渲染链路不可用。

**改了默认文档没生效？** 默认内容只在没有 `mdtu-content` 时加载，先执行 `localStorage.removeItem('mdtu-content')` 再刷新。

---

## 未来规划

| 编号 | 模块 | 状态 | 说明 |
|------|------|------|------|
| **F1** | 导出能力 | ✅ | 复制 MD / HTML / PDF / Word / 打印 |
| **F2** | 界面与交互优化 | ⬜ | 字体排版、交互效率、提示反馈、无障碍、响应式 |
| **F3** | 主题模板体系 | 🟦 | 已精简为 2 套；token → CSS 生成器未做 |
| **F4** | 文档元数据 | ✅ | Front Matter → 属性面板 |
| **F5** | 文件夹模式 | 🟦 | F5-a 只读已落地；写回 / 文件管理 / 冲突检测未做 |
| **F6** | 预览模式（设备档） | ✅ | PC / iPad / APP |
| **F7** | PWA | ✅ | 安装 + `.md` 文件关联 |

规划背景与技术方案见 [ROADMAP.md](./ROADMAP.md)，主题调研见 [F3-THEME-RESEARCH.md](./F3-THEME-RESEARCH.md)，文件夹模式见 [F5-FOLDER-MODE.md](./F5-FOLDER-MODE.md)。

---

## 二次开发

改完刷新浏览器即可，没有构建步骤。**改动前请先读 [DESIGN.md](./DESIGN.md)**，尤其是附录「二次开发要点」——那里记着几类会静默失效的坑（主题色 4 处平行、预览容器 class 唯一出口、Mermaid 度量 6 处同值、打印样式只作用于打印等）。

最容易踩的三条：

- **滚动容器**是 `#previewWrap` 与 `textarea#editor`，监听绑错位置会静默失效。
- **`splitFrontMatter()` 必须在 `marked.parse()` 之前调用**，否则元数据会被解析成 `<hr>` + 吞掉内容的假 `<h2>`。
- **js-yaml 必须显式传 `CORE_SCHEMA`**，默认 schema 会把日期变成 `Date` 对象，东八区显示成前一天。

---

## 许可证

[MIT](./LICENSE)
