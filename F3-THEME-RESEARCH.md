# F3 · 主题体系外部站点调研（可行性分析）

> **状态**：调研完成，**尚未落地**（2026-10-13）
> **定位**：F3「主题模板体系」的**前置调研**。ROADMAP 的 F3 章节只保留结论摘要，完整取证与分析放在这里。
> **调研对象**：用户提供的两个对标站点 —— `https://md.axiaoxin.com/`、`https://md.payforchat.com/`
> **取证方式**：抓原始 HTML → 定位构建产物 `.css` / `.js` → 反解析主题定义。所有片段均来自实际抓取，非推测。
> 抓取的留档文件：站点 A `main.c20feff6.chunk.css`(16 KB) / `7.cd2ce0ff.chunk.css`(535 KB) / `main.6c955878.chunk.js`(791 KB)；站点 B `index-BsWMX7tZ.css`(52 KB) / `index-CCs2ZUT8.js`(805 KB)。

---

## 1. 结论先行

| 站点 | 一句话判断 | 对本项目可用的是什么 |
|------|-----------|--------------------|
| A `md.axiaoxin.com` | **GPL-3.0 的 mdnice Fork**，101 套主题，质量高、可直接移植，但**许可证是硬否决点** | **只作视觉参考**，clean-room 重写；它的「juice 内联 CSS + 公式图片化」思路可无偿借鉴 |
| B `md.payforchat.com` | **闭源商业产品**，13 套主题，主题实现绑死 Vite + Tailwind，源码不可得 | 它的 **「token 对象 → 拼 CSS 字符串」生成器**思路最值得学 —— 零依赖即可自研，且正好治本项目的「改主题色要改四处」 |

**优先级最高的可落地项不是「搬主题」，而是自研一个 token → CSS 的轻生成器**（见 §5.1）。

---

## 2. 站点 A：`md.axiaoxin.com`（人言兑.md）

### 2.1 它是什么

| 项 | 结论 | 证据 |
|---|---|---|
| 技术栈 | React 16 + antd + mobx + CodeMirror，**create-react-app** 打包的纯静态 SPA | HTML 引用 `/static/js/main.6c955878.chunk.js`、`/static/css/main.c20feff6.chunk.css`；JS 内含 `bit.ly/CRA-PWA` 与 antd 组件源码 |
| Markdown 内核 | `markdown-it` + MathJax + highlight.js + **`@mdnice/sitdown`** + **`juice`** | JS 中出现 `github.com/mdnice/sitdown`、`#nice`、`juice.inlineContent` |
| 开源 | **是** | `https://github.com/axiaoxin-com/wx.md` |
| License | **GPL-3.0** | 仓库标注 GPL-3.0；README 原文：「Fork 自 Markdown2Html，略有调整。**原出处：https://github.com/mdnice/markdown-nice**」 |
| 上游 | **mdnice / markdown-nice**（GPL-3.0，4.7k stars） | 线上部署与 mdnice 同构：IndexedDB `mdnice-local-history`、API `https://math.mdnice.com`、`https://preview.mdnice.com/themes`、提示语「已复制且添加 mdnice 排版后缀」 |

> ⚠️ 站点 A 与上游 mdnice 同为 **GPL-3.0**。本项目是 **MIT**，直接搬运会触发传染性义务。

### 2.2 主题体系

- **数量**：`themes` 数组 **101 套命名主题 +「默认(normal)」+「自定义(custom)」**。
- **实现方式**：**JS 数组 + 运行时注入 `<style>`**。每个主题是一个 JS 对象：
  ```js
  { themeId: "anye", name: "暗夜骑士", css: "…", createdAt: "2025-05-17", isDark: true }
  ```
  主题 CSS 全部内联打进 `main.chunk.js`（**没有独立主题源文件，也没有主题 API**）。页面初始化时建 **4 个 `<style>` 层**，主题 CSS 进 `markdown-theme`：
  ```js
  ["basic-theme","markdown-theme","code-theme","font-theme"].forEach((n) => {
    const e = document.createElement("style"); e.id = n;
    document.getElementsByTagName("head")[0].appendChild(e);
  });
  // 切主题时：qt("markdown-theme", themeCss)
  ```
- **选择器根**：全部以 `#nice` 为限（全文出现 `#nice` 4373 次）—— 与本项目 `.theme-*` 前缀是同一个思路，**机械改名即可适配**。
- 仓库里的主题源文件路径：`src/template/index.js`、`src/template/markdown/xxx.js`。

### 2.3 代表性主题的实际 CSS

**`notion`**：
```css
#nice blockquote { border-left: 3px solid rgba(55,53,47,.16); background: rgba(55,53,47,.03);
  color: #37352f; padding: 16px; margin: 16px 0; border-radius: 3px; }
#nice pre { background: rgba(55,53,47,.03); border-radius: 3px; padding: 16px; margin: 16px 0; }
#nice code { font-family: SFMono-Regular, Consolas, Menlo, monospace; font-size: .9em;
  background: rgba(55,53,47,.03); padding: .2em .4em; border-radius: 3px; }
#nice th, #nice td { border: 1px solid rgba(55,53,47,.16); padding: 8px 12px; text-align: left; }
#nice th { background: rgba(55,53,47,.03); font-weight: 600; }
#nice a { color: #2eaadc; border-bottom: 1px solid rgba(46,170,220,.4); font-weight: 500; }
```

**`axiaoxin`（作者自制）**：
```css
#nice h2 { font-size: 24px; text-align: center; display: table; font-weight: bolder;
  margin: 54px auto 36px; padding: 6px 0; border-bottom: 4px solid #404040; }
#nice h3 { font-size: 22px; padding-left: 8px; border-left: 4px solid #404040; }
#nice h4 { font-size: 20px; display: inline-block; padding-bottom: 2px; border-bottom: 2px solid #404040; }
```

公式：`#nice .inline-equation svg { … }` —— MathJax 渲染成 SVG，主题针对 `svg` / `.mjx-container` 调样式。

### 2.4 复制到公众号：怎么绕开微信剥 `<style>`

**核心是 CSS 内联化（`juice`）**：
```js
const t = document.getElementById("basic-theme").innerText;      // 基础
const i = document.getElementById("markdown-theme").innerText;    // 主题
const r = document.getElementById("code-theme").innerText;        // 代码
const a = document.getElementById("font-theme").innerText;        // 字体
// ↓ 把 4 层 CSS 的每条规则写进对应元素的 style 属性
const l = juice.inlineContent(html, t + i + r + a,
  { inlinePseudoElements: true, preserveImportant: true });
await navigator.clipboard.write([ new ClipboardItem({
  "text/html": new Blob([n], { type: "text/html" }),
  "text/plain": new Blob([n], { type: "text/plain" }) }) ]);
```
配套细节：
- 每个元素追加署名：`d.setAttribute("data-tool", "人言兑.md-公众号排版编辑器")`
- **公式图片化**（微信不跑 MathJax）：把 `mjx-container` 换成 `<img class="Formula-image" data-eeimg="true" alt="LaTeX源码">`

### 2.5 设备预览 / 多平台预览

- **设备预览：有，2 档（PC / 手机）**。状态 `preview_type`（默认 `"mobile"`，存 localStorage），**靠换容器 class 改宽度**：
  ```css
  .nice-wx-box    { max-width: 768px; box-shadow: 0 0 60px rgba(0,0,0,.1); padding: 25px 20px; } /* 手机 */
  .nice-wx-box-pc { width: 100%; padding: 20px 35px 20px 20px; box-shadow: none; }              /* 电脑 */
  ```
- **多平台预览：没有独立的平台预览样式层**。多平台体现在**内容导入**（SitDown 支持 GFM / wechat / zhihu / juejin / csdn 解析）与导出（PDF / Markdown）。

---

## 3. 站点 B：`md.payforchat.com`（MarkCopy）

### 3.1 它是什么

| 项 | 结论 | 证据 |
|---|---|---|
| 技术栈 | **Vite + React + Tailwind CSS** 的纯静态 SPA | HTML 引用 `/assets/index-CCs2ZUT8.js`、`/assets/index-BsWMX7tZ.css`；CSS 首部是 Tailwind `--tw-*` 变量与 preflight |
| Markdown 内核 | `markdown-it`（`{html:!0, linkify:!0, typographer:!0, highlight}`）+ **KaTeX** + highlight.js | JS 内含 markdown-it 源码与 `math_inline` / `math_block` 规则 |
| 开源 | **否 —— 未找到仓库** | WebSearch 仅命中同名的无关 VS Code 插件 `owenpkent/markcopy`；站点 HTML 无任何 GitHub 链接 |
| License | **未能获取**（闭源，无声明） | JS 里的 `MIT` 字样均来自打包的第三方依赖 |

> 结论：站点 B 是 PayForChat 团队的**闭源免费产品**，不存在「抄源码」的合法路径，只能观察交互与设计后自研。

### 3.2 主题体系

- **13 套内置主题 +「主题实验室」**：`github` / `wechat` / `wechat_fresh` / `wechat_business` / `notion` / `juejin` / `dark` / `xiaohongshu` / `minimalist` / `techblog` / `literary` / `print` / `hongfei`。
- **实现方式：设计 token → 运行时拼 CSS**。
  - token 默认值（`ya`）：
    `palette{primary, accent, heading, body, strong, background, codeBg, codeText}` /
    `typography{fontFamily, bodySize, heading1Size…, lineHeight}` /
    `layout{contentWidth, radius, imageRadius, codeRadius}` /
    `effects{imageShadow, codeShadow}`
  - 生成器 `tE(tokens)` 用模板字符串把 token 拼成 CSS：
    ```js
    tE = (e = ya) => { const t = dd(ya, e); … return `
      .preview-body { font-family:${w}; font-size:${d}px; line-height:${p}; color:${n.body}; … }
      .preview-body h2 { border-left:4px solid ${n.primary}; background:${O}; … }`; }
    ```
  - 采用 token 的主题：wechat / wechat_fresh / wechat_business / techblog / literary；其余为写死 CSS 字符串。
  - 选择器统一挂 `.preview-body`；自定义主题存 `localStorage["markcopy.customThemes"]`。

### 3.3 代表性主题的实际 CSS

**`github`（完整）**：
```css
.preview-body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 16px; line-height: 1.75; color: #1f2328; background: #fff; padding: 24px; max-width: 700px; margin: 0 auto; }
.preview-body h2 { font-size: 1.5em; font-weight: 600; margin: 24px 0 16px; padding-bottom: .3em; border-bottom: 1px solid #d1d9e0; }
.preview-body a { color: #0969da; text-decoration: none; }
.preview-body code { font-family: "SFMono-Regular", Consolas, Menlo, monospace; font-size: 85%;
  background: rgba(175,184,193,.2); padding: .2em .4em; border-radius: 6px; }
.preview-body pre { background: #161b22; border-radius: 6px; padding: 16px; overflow: auto; }
.preview-body pre code { background: none; padding: 0; font-size: 85%; color: #e6edf3; }
.preview-body blockquote { padding: 0 1em; color: #656d76; border-left: 3px solid #d1d9e0; }
.preview-body th, .preview-body td { border: 1px solid #d1d9e0; padding: 6px 13px; }
.preview-body tr:nth-child(even) { background: #f6f8fa; }
```

**`juejin`**：
```css
.preview-body a { color: #1e80ff; }
.preview-body code { background: #f2f3f5; color: #e3614f; border-radius: 4px; }
.preview-body pre { background: #1e2330; border-radius: 8px; padding: 16px; }
.preview-body pre code { background: none; padding: 0; color: #abb2bf; font-size: 90%; }
.preview-body blockquote { padding: 12px 16px; border-left: 4px solid #e64a19; }
```

### 3.4 复制到公众号：怎么绕开微信剥 `<style>`

**自研 `getComputedStyle` 遍历内联**（零依赖）：
```js
function Mb(e, t) {                       // e = 源节点, t = 克隆节点
  const a = window.getComputedStyle(e);
  const r = ["font-size","font-weight","font-family","color","background-color",
             "margin…","padding…","border","border-radius","border-left","box-shadow",
             "text-decoration","text-align","display","max-width","overflow",
             "word-break","white-space"];
  let u = '';
  for (const d of r) { const p = a.getPropertyValue(d); p && (u += `${d}:${p};`); }
  t.setAttribute("style", u);             // …递归子节点
}
const a = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }) });
await navigator.clipboard.write([a]);     // 失败回退 execCommand 选区复制
```
三个微信坑的补丁：
- **列表 `::before` + `counter()` 微信不支持** → 把有序/无序列表的编号转成真实行内 `<span>`
- **外链图片会被拦** → `img[src^="http"]` 全部 fetch 后 `readAsDataURL` 转 base64（10 MB 上限，带 CORS 与 `?_cors=1` 重试）
- **知乎专用路径** → 目标为知乎时改用 markdown-it 重渲染的干净 HTML

### 3.5 设备预览 / 多平台预览

- **设备预览：有，3 档（电脑 / 手机 / iPad）**。`[{id:"desktop",label:"电脑"},{id:"phone",label:"手机"},{id:"ipad",label:"iPad"}]`，**实现是套设备外框**（状态栏 + `rounded-[18px]` 屏幕圆角），而不是只改宽度。
- **多平台预览：只有 2 个复制目标**（公众号 / 知乎）。主题里的「掘金风格」只是**视觉主题**，掘金并非复制目标。

---

## 4. 两个站点的问题，本项目已经解决了的

| 能力 | 站点 A | 站点 B | 本项目 |
|---|---|---|---|
| 主题数量 | 101 | 13 | **2**（2026-10-13 精简后） |
| 主题 CSS 与「复制用内联样式」是否同源 | 否（4 层 `<style>` + juice 运行时内联） | 是（token 生成器同源） | **否 —— 两处平行维护，改主题色要顾四处** |
| 公式 | MathJax → 复制时图片化 | KaTeX | **KaTeX；复制时公式会丢**（未图片化） |
| 外链 | 保留（微信里点不动） | 保留 | **已有「外链转脚注」** |
| 多平台预览 | 无 | 2 个目标（公众号/知乎） | **无**（本项目提供设备档预览，见 DESIGN §7.9） |
| 设备预览 | PC / 手机 | 电脑 / 手机 / iPad + 外框 | **PC / iPad / APP + 外框**（本轮新增） |

---

## 5. 可行性初判（对照本项目「零构建 + CDN + 无新依赖」）

评估基准：纯静态、零构建、依赖走 CDN、主题为 `css/style.css` 的 `.theme-*` class + 一份平行维护的内联样式串、用途是「Markdown → 公众号 / HTML / PDF / Word」。

### 5.1 【最高性价比】自研 token → CSS 轻生成器 —— **可直接做，零新依赖**

学站点 B 的 `tE` 思路，但不用 Tailwind、不用构建：

```js
const THEME_TOKENS = {
  qingkong: { palette: { primary: '#66CCFF', … }, typography: { bodySize: 16, lineHeight: 1.8 }, layout: { radius: 4 } },
  github:   { … },
};
function themeCss(tokens) { … return '…' ; }   // 一份 token 拼出 CSS 字符串
```

**收益**：一处 token 同时驱动两处产物（`<style>` 注入的预览样式 + 复制的内联样式串），直接消灭「改主题色要顾四处」这个已知痛点，且完全符合零构建约束。**这是本次调研里唯一「投入小、收益大、无风险」的项。**

### 5.2 【主题外观】clean-room 重写 —— **可做，但必须自己写**

站点 A 那 101 套主题的 CSS 质量高、结构（`.theme-*` + 元素选择器）与本项目完全同构，机械改名即可移植 —— **但 GPL-3.0 是硬门槛**：

| 选项 | 结果 |
|---|---|
| 整段复制其主题 CSS | ⛔ 本项目需整体转 GPL-3.0，否则侵权 |
| **只作视觉参考、按本项目前缀重写** | ✅ 推荐，保持 MIT（思路与配色不受版权保护，CSS 表达是） |
| 内部自用、不再分发 | ⚠️ 仍有争议，不推荐作为依据 |

### 5.3 【公众号兼容】复制时 CSS 内联 —— **可做，两条路**

| 方案 | 依赖 | 评价 |
|---|---|---|
| `juice` UMD（`cdn.jsdelivr.net/npm/juice@11/dist/juice.min.js`） | **+1 CDN 依赖**（站点 A 的做法） | 成熟，但违反「无新依赖」偏好；且要有 `<style>` 文本可喂 |
| 自研 `getComputedStyle` 遍历（站点 B 的做法） | **零依赖** | 但**「强制内联」会锁死样式**，且本项目已有内联样式串，二者取舍要想清楚 |

> 本项目当前状况是「预览用 class + `<style>`，复制用 `getThemeStyles()` 内联串」，**没有走 getComputedStyle 这条路**。是否切换属于 F3 的架构决策，见 §6。

### 5.4 【不做】

- ⛔ 直接搬运站点 A 的主题 CSS（GPL 风险）
- ⛔ 试图复刻站点 B 的 Vite / Tailwind 链路（违反零构建）
- ⛔ 复刻站点 A 的 101 套主题规模（维护成本远超收益，本项目 2–6 套已够）

---

## 6. 对 ROADMAP F3 的结论修正

| F3 原有表述 | 本次调研的修正 |
|---|---|
| 「mdnice 20 套主题」「mdnice 7 套代码主题」 | 站点 A 的**实际线上版本已是 101 套**（Fork 后大幅扩过）；数量不是问题，**许可证才是** |
| 「优先以 doocs/md（MIT）为蓝本」 | 仍然成立；本次新增的站点 B 给出第二条路 —— **它的 token → CSS 生成器结构比 doocs/md 的三段式更轻，更贴合本项目** |
| 「微信会剥 `<style>`，主题样式必须内联到每个元素的 style」 | 确认，两站的解法都是**复制时**做内联（A 用 juice、B 用 getComputedStyle），**预览期仍用 `<style>`** —— 即「预览用 class、复制才内联」，与本项目现状一致，不必改成全部内联 |
| 任务「迁移现有 4 套主题到新结构」 | 现已精简为 **2 套**（GitHub / 晴空蓝），迁移成本同步下降 |
| 设计建议「先做 6 套：…、姹紫、凝夜紫（暗色）」 | 暗色主题会带来打印 / 复制（微信白底）的一系列额外问题，**建议在本轮先把浅色主题做扎实** |

---

## 7. 未获取项（如实登记）

- 站点 B 的**许可证与作者仓库**：已 WebSearch，仅命中同名的无关 VS Code 插件，判定为闭源。
- 站点 B **token 主题运行时生成后的最终 CSS 文本**未逐字节抓取；但生成函数 `tE` 与全部 token 默认值已取证，可完整复现。
- 站点 A 的 101 套主题**未逐套抓取**（只在 JS 中确认了数组规模与命名清单）。

---

## 8. 参考链接

- `https://md.axiaoxin.com/` → 仓库 `https://github.com/axiaoxin-com/wx.md`（GPL-3.0）
- 上游 `https://github.com/mdnice/markdown-nice`（GPL-3.0）
- `https://md.payforchat.com/`（闭源，无仓库）
- 本项目已登记的 MIT 蓝本：`https://github.com/doocs/md`
