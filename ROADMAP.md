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
- [非目标](#非目标)
- [维护约定](#维护约定)
- [参考链接](#参考链接)

---

## 总览

| 编号 | 模块 | 优先级 | 状态 | 依赖 | 预估工作量 |
|------|------|--------|------|------|------------|
| F1 | 导出能力（复制 MD / 导出 PDF / Word / HTML） | P0 | ⬜ | 无 | 中 |
| F2 | 界面与交互优化 | P1 | ⬜ | 无 | 中～大 |
| F3 | 主题模板体系 | P1 | ⬜ | 建议先解决内联样式问题 | 大 |

**共同前置约束**：项目目前是「零构建 + CDN 引入」的纯静态三文件，任何新增依赖都要么走 CDN `<script>`，要么会引入构建步骤并改变「双击 `index.html` 就能跑」这一性质。引入前请先在此登记并同步更新 README。

---

## F1 · 导出能力（复制 MD / PDF / Word / HTML）

### 背景

项目当前**没有任何导出能力**——这是 README「已知限制」里的第 1 条。正文只存在 localStorage，换浏览器、清缓存即丢失，用户唯一的内容出口是「复制为富文本」。补齐导出是把工具从「能写」变成「能留存」的关键一步。

### 交互设计

在顶部右侧「复制」按钮旁新增**「导出」下拉菜单**，收纳四个动作，避免顶栏按钮继续膨胀：

- 复制 Markdown（源码）
- 导出 HTML
- 导出 PDF
- 导出 Word

四个动作统一通过**浏览器下载**落盘（`Blob` + `URL.createObjectURL` + `<a download>`），不经过任何服务端。

### 技术方案

#### 1. 复制 Markdown — 零依赖

```js
await navigator.clipboard.writeText(editor.value);
```

**坑**：Clipboard API 要求安全上下文（HTTPS 或 `localhost`）。README 目前允许以 `file://` 直接双击打开，该场景下 API 不可用，必须保留 `document.execCommand('copy')` 降级路径。

#### 2. 导出 HTML — 零依赖

拼一份独立可用的 HTML 文件：`getThemeStyles(theme)`（app.js:644）输出的主题样式 + `preview.innerHTML` + 必要的外链 CSS。

**必须一并内联的样式，否则导出文件会变形：**

| 内容 | 原因 |
|------|------|
| 主题 CSS | 决定整体排版 |
| highlight.js 样式 | 代码高亮是 class 形式，脱离 CDN 即失效 |
| KaTeX 样式 | 公式依赖 `.katex-*` 系列 class，缺了会错位 |
| Mermaid | 已渲染为内联 SVG，无需额外处理 |

#### 3. 导出 PDF — 两方案二选一

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A（推荐先做）** | `window.print()` + 新增 `@media print` 规则 | 零依赖、矢量清晰、可选页边距/页眉页脚 | 需用户在打印对话框选「另存为 PDF」，多一步 |
| B | html2pdf.js（html2canvas + jsPDF） | 一键直出 | 基于截图，中文 / KaTeX / Mermaid SVG 易糊或缺失；新增约 200KB CDN 依赖 |

注意：`css/style.css` 当前**完全没有 `@media print` 规则**（全文 0 处），走方案 A 必须补上，否则打印结果会带上顶栏、工具栏和编辑区。

#### 4. 导出 Word — 两方案二选一

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A（快速落地）** | 以 `application/msword` MIME 输出 `.doc` | 复用现有 HTML 渲染结果，改动极小 | 本质是 HTML 套壳，非真正 `.docx`；部分客户端会弹格式兼容性警告 |
| B（规范） | 用 `docx` 库生成真 `.docx` | 标准格式，Word/WPS 无警告 | 需把 Markdown AST 映射到 `Paragraph` / `Table` / `Image`，表格、代码块、公式、图片都得单独处理，工作量大且引入构建 |

### 任务拆解

- [ ] 顶部新增「导出」下拉组件（HTML + CSS）
- [ ] 抽出 `exportHtml()`：主题样式 + hljs 样式 + KaTeX 样式内联
- [ ] 实现复制 Markdown（含 `file://` 降级路径）
- [ ] 实现导出 HTML（文件名建议取自首个 H1 标题，缺省 `document.md`）
- [ ] 补充 `@media print` 样式，实现导出 PDF
- [ ] 实现导出 Word（先做方案 A，观察反馈再决定是否需要 B）
- [ ] 四个动作统一接入 Toast 成功/失败反馈

### 验收标准

1. 四种导出在 Chrome + Edge 均可落盘，文件名与内容正确
2. 导出的 HTML 断网后打开，代码高亮、公式、图表均正常
3. 导出的 PDF 不含顶栏与工具栏，分页处不切断代码块
4. 导出的 Word 用 WPS 与 Word 打开均保留基本排版
5. 在 `file://` 下打开时，复制 Markdown 仍能工作（走降级）

---

## F2 · 界面与交互优化

### 现状问题清单（已逐项核实代码）

| 问题 | 代码依据 |
|------|----------|
| 无打印样式 | `css/style.css` 全文 0 处 `@media print` |
| 无无障碍属性 | `js/app.js` 全文 0 处 `aria-label` / `role` |
| 字体栈缺兜底 | 编辑器使用 `JetBrains Mono / Fira Code / SF Mono / Cascadia Code`，多数机器未安装，实际回退到系统默认，观感不一致 |
| 提示无分级 | `showToast(msg, type)` 支持 `success` / `error`，但调用处几乎只用 success；失败路径（如 URL 采集失败）反馈不足 |
| 危险操作确认覆盖不全 | 仅「打开文件」「清空内容」有 `confirm()`（app.js:825 / 842），删除模板等无确认 |
| Esc 关闭弹窗未统一 | 仅「水印」弹窗实现；模板 / URL / 更多工具三个弹窗缺失 |
| 无查找替换 | — |
| 无图片粘贴/拖拽上传 | 仅支持手写图片链接语法 |
| 无字号、行高、明暗主题调节 | — |
| 无响应式适配 | 分屏布局面向桌面端，窄屏下不可用 |

### 优化项

**1. 字体与排版**（P1）

- 重排字体栈，补上等宽与中文字体的显式兜底（`Consolas` / `Microsoft YaHei` / `monospace`）
- 编辑器字号、行高可调（写入 localStorage）
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

### 调研结论

| 项目 | License | 主题机制 | 主题数量 | 复制到公众号 |
|------|---------|----------|----------|--------------|
| [doocs/md](https://github.com/doocs/md) | **MIT** | `src/config/theme.ts` 三段式配置（Base / Block / Inline Elements）+ 自定义 CSS 编辑器（`css2json`、`customCssWithTemplate`、`customizeTheme`） | 3 套内置：`default`（经典）/ `grace`（优雅）/ `simple`（简洁）；可叠加自定义主题色（11 种预设 + 取色器）、字体（无衬线 / 衬线 / 等宽）、字号 14–18px、代码块主题、图注格式 | 支持 |
| [mdnice / markdown-nice](https://github.com/mdnice/markdown-nice) | **GPL-3.0** | 主题为整段 CSS，另提供 Mac 风格代码块 | 20 套文章主题 + 7 套代码主题 | 支持（公众号 / 知乎 / 掘金） |
| 本项目现状 | MIT | CSS class 前缀 `.theme-*`，样式写在 `style.css` | 4 套：GitHub / 山吹 / 山月 / 凝夜紫 | 支持，但有风险（见下） |

**mdnice 20 套主题**：默认、山吹、蔷薇紫、全栈蓝、凝夜紫、萌绿、极简黑、橙心、墨黑、姹紫、绿意、嫩青、WeChat-Format、兰青、前端之巅同款、极客黑、红绯、蓝莹、科技蓝、简
**mdnice 7 套代码主题**：atom-one-dark、monokai、github、vs2015、atom-one-light、xcode、wechat

### ⚠️ License 风险（务必先看）

本项目是 **MIT**，而 mdnice 是 **GPL-3.0**——**直接搬运其主题 CSS 会因 GPL 的传染性，要求本项目整体转为 GPL-3.0**。

可选处理：

1. **只借鉴配色思路，自行实现**（推荐，保持 MIT）
2. 明确改用 GPL-3.0 并在 README 声明来源与许可变更

doocs/md 为 MIT，参考与借鉴其主题结构没有该风险，优先以它为蓝本。

### 关键技术约束（决定成败）

微信编辑器会过滤 `<style>` 标签与 class，**主题样式必须内联到每个元素的 `style` 属性上**。

本项目当前的复制路径是注入一整个 `<style>` 块（`getThemeStyles()`，app.js:644），存在被微信剥离的风险——这是 F3 必须一并解决的前置问题。

参考 doocs/md 的做法：把主题定义为**样式配置对象**，通过 marked 的自定义 `RendererObject` 在渲染时把样式写进每个标签的 `style`，而不是输出 class + 外部样式表。

### 设计建议

- **文章主题**：先做 6 套 —— 经典 GitHub（现有）、优雅、极简、科技蓝、姹紫、凝夜紫（暗色）
- **代码主题**：与文章主题解耦、独立切换 —— atom-one-dark / github / monokai / xcode / vs2015
- **主题色**：支持取色器覆盖主色（背景留白由主题决定，避免用户调出不可读的配色）
- **自定义 CSS**：进阶能力，提供选择器模板供用户覆写

### 任务拆解

- [ ] 重构渲染管线：自定义 `RendererObject`，输出内联 style（**前置项**）
- [ ] 定义主题数据结构（Base / Block / Inline 三段式）
- [ ] 迁移现有 4 套主题到新结构
- [ ] 新增优雅 / 极简 / 科技蓝等主题（自研，避免 GPL 风险）
- [ ] 代码主题独立切换（接入 hljs 多套样式）
- [ ] 主题选择器重新在顶栏露出（当前被 `display:none` 隐藏）
- [ ] 主题选择写入 localStorage
- [ ] 在真实公众号后台验证粘贴效果

### 验收标准

1. 切换主题后预览即时生效，刷新后保持
2. 复制粘贴到公众号后台，样式**完整保留**（不依赖 `<style>` 标签）
3. 代码主题可独立于文章主题切换
4. 新增主题只需追加一份配置，不改渲染逻辑
5. 全部主题样式为自研或来自 MIT 项目，README 中标注来源

---

## 非目标

以下方向本期**明确不做**，避免范围蔓延：

- 后端服务、账号体系、云同步
- 图床集成（图片上传链路应单独立项）
- AI 辅助写作
- 多人协作与版本历史
- 移动端 App / 桌面客户端

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
- [doocs/md 主题与样式定制说明](https://deepwiki.com/doocs/md/3.2-theme-and-style-customization)
- [marked](https://github.com/markedjs/marked) — 本项目的解析引擎，自定义 Renderer 文档
- [highlight.js](https://github.com/highlightjs/highlight.js) — 代码主题样式来源
- [MDN：Clipboard API](https://developer.mozilla.org/zh-CN/docs/Web/API/Clipboard_API)
- [MDN：Blob / URL.createObjectURL](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL)
