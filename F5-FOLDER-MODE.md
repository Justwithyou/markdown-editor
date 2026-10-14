# F5 文件夹模式 · 设计方案

> **文档定位**：本文是 [ROADMAP.md](./ROADMAP.md) 中 **F5** 的完整设计方案，描述「**要做什么**」；与描述「**当前是什么**」的 [DESIGN.md](./DESIGN.md) 分工明确。落地完成后，本文中仍然成立的结论应合并进 DESIGN.md，本文则归档。
>
> **状态**：🟦 **F5-a 已实现**（2026-10-13 落地、2026-10-14 修订，分支 `feature-folder`）；F5-b / F5-c / F5-d 待做。落地详情见 §11，与规划不一致之处也在那一节列明。
>
> §9.1 的三项待拍板已确认（见该节），§9.4 的前置验证已由用户手动确认通过。
> 2026-10-14 复核后，**`move()` 那条「近似原子写入」路线已废弃**——`createWritable()` 自带该语义，见 §3.8。

---

## 目录

- [1. 需求与目标](#1-需求与目标)
- [2. 现状与约束](#2-现状与约束)
- [3. 能力实测（可行性判定）](#3-能力实测可行性判定)
- [4. 方案选型](#4-方案选型)
- [5. 总体设计](#5-总体设计)
- [6. 详细设计](#6-详细设计)
- [7. 风险与边界](#7-风险与边界)
- [8. 分期落地与验收](#8-分期落地与验收)
- [9. 待决问题](#9-待决问题)
- [10. 参考](#10-参考)
- [11. 落地记录（F5-a）](#11-落地记录f5-a2026-10-13)

---

## 1. 需求与目标

用户原话（2026-10-13）：

> 我想增加直接打开整个文件夹，并实时在线编辑的功能，目前的设计可以实现嘛，先讨论，不要动手做任何事情

拆成三件可验收的事：

| # | 目标 | 验收口径 |
|---|------|----------|
| 1 | **打开整个文件夹** | 选定一个目录后，能枚举出目录结构并展示为文件树 |
| 2 | **切换文档** | 点文件树上的节点，编辑器与预览一起换成该文件的内容 |
| 3 | **实时在线编辑** | 编辑结果能写回磁盘上的**原文件** |

目标 3 里的「实时」是歧义词，必须拆成两件事才能谈（见 §5.3）：**本地写回**（改了就存盘）与**跟随外部改动**（磁盘被别人改了要知道）。这两件事的成本与风险完全不同。

### 1.1 这项功能把工具推到了什么位置

现有定位是**「微信公众号排版器」**（DESIGN §1）。文件夹模式会把它推向**「本地 Markdown 编辑器」**——这是一个方向性的扩张，不是一次功能叠加：

| 维度 | 现状（单篇排版器） | 文件夹模式（本地编辑器） |
|------|--------------------|--------------------------|
| 输入 | 自己写 / 打开一个文件 | 一整个 vault |
| 状态 | 一份正文 | N 份文档 + 每份的脏状态 |
| 输出 | 剪贴板（公众号） | 剪贴板 **+ 磁盘** |
| 必须处理 | XSS、样式 | **数据安全**（覆盖、编码、冲突） |

**因此本文的第 7 节「风险与边界」比技术方案本身更重要**：本项是唯一一个能造成用户数据不可逆丢失的功能。

---

## 2. 现状与约束

### 2.1 单文档假设清单（已逐项核实代码）

| # | 假设点 | 代码位置 | 现状 | 改造方向 |
|---|--------|----------|------|----------|
| 1 | 正文只有一份 | `saveContent()` / `loadContent()`（app.js:2036 / 2040） | 固定读写 `localStorage['mdtu-content']` 一个键 | 拆出「按文档 id 存取」层，与单文档模式并存 |
| 2 | 输入即全量落库 | `editor.addEventListener('input')` → `saveContent()`（app.js:1383） | 无「当前文档」概念，无脏标记 | 引入 `currentDoc` 与 `dirty` 状态 |
| 3 | `Ctrl+S` 只写 localStorage | app.js:1913 | 项目至今**没有任何写回磁盘的能力** | 文件夹模式下语义升级为「写磁盘」 |
| 4 | 打开文件即覆盖 | app.js:1515–1537 | 读入后直接赋 `editor.value`；`file.name` 不外传、也不保存 | 保留为兜底入口，新增路径要记文档身份 |
| 5 | 编码固定 UTF-8 | `reader.readAsText(file, 'utf-8')`（app.js:1535） | 单文档模式下 GBK 文件**已经会乱码** | 改为 ArrayBuffer + BOM 嗅探（见 §6.4） |

### 2.2 最有利的一条：渲染层是纯函数

`renderMarkdown()`（app.js:547）是 `editor.value` 的**纯函数**——它不关心「当前是哪个文件」。因此切换文档的本质就是：

```js
editor.value = newContent;   // 换内容
renderMarkdown();            // 其余全自动
```

四套主题、Front Matter「属性」面板、水印、外链转脚注、大纲、字数统计、自动编号**全部零改动**。这是本项最大的有利条件，也决定了改动面集中在**状态与 IO 层**，而不是渲染层。

### 2.3 现成可复用的 UI 落点

| 落点 | 位置 | 可复用之处 |
|------|------|------------|
| `.outline-panel`（文档大纲浮层） | app.js:1663 / 1808 | 已是「右侧浮层 + `.show` 切换」的成熟模式，文件树可照搬这套结构与样式 |
| 顶栏右侧按钮组 | DESIGN §5.1 | 「打开文件」的既有落点在 app.js:1515；2026-10-14 起它与新增的「打开文件夹」一起收进顶栏「打开」下拉，不再各占一个按钮 |
| `.resizer` 分栏 | DESIGN §5.2 | 若文件树做左侧抽屉，宽度可复用这套拖拽逻辑 |

### 2.4 项目级约束

1. **零构建 + CDN + 双击即跑**（DESIGN §2 / ROADMAP 共同前置约束）——F5 只用浏览器原生 API，**零新增依赖**，是该约束的例外。
2. **单文件 IIFE**（`app.js`，落地时为 2629 行）——新增代码应保持同一组织方式，不引入模块化。
3. **微信优先**——文件夹模式**不改变**核心场景；公众号排版链路必须完全不受影响。
4. **`file://` 必须继续可用**——README「方式二：直接双击打开」是既有的使用路径，不能被 F5 破坏（§3 实测正是为确认这一点）。

---

## 3. 能力实测（可行性判定）

### 3.1 唯一的关键问题

「能不能做」只取决于一件事：**`file://` 下 File System Access API 是否可用**——它决定 README 的「方式二：直接双击打开」要不要废弃。这个不能靠印象拍板。

### 3.2 实测环境与方法

| 项 | 值 |
|----|-----|
| 浏览器 | Microsoft Edge **155.0.4283.45**（本机，`--headless=new`） |
| 方法 | 探针页上报 `isSecureContext` / API 暴露情况，并**真实调用一次** `showDirectoryPicker()` 捕获异常 |
| 对照设计 | 三个上下文并列：`file://`、`http://localhost`（安全）、`http://<局域网 IP>`（**非**安全） |

### 3.3 结果

| 场景 | origin | `isSecureContext` | `typeof showDirectoryPicker` | 实际调用结果 |
|------|--------|-------------------|------------------------------|--------------|
| A | `file://` | **true** | `function` | `SecurityError: Must be handling a user gesture to show a file picker.` |
| B | `http://127.0.0.1:20075` | true | `function` | 同上（缺用户手势） |
| **C（对照组）** | `http://192.168.5.197:20075` | **false** | **undefined** | `TypeError: window.showDirectoryPicker is not a function` |

### 3.4 结论

1. **该 API 由 `[SecureContext]` 门控**——场景 C 里**连函数都不存在**，说明拦截发生在「函数暴露」之前，而不是调用时。
2. 因此场景 A 的 `SecurityError` **不可能**来自安全上下文检查，只能是缺用户手势（headless 造不出真实手势）。
3. 即 **`file://` 满足安全上下文要求，API 可用**（`file://` 属 spec 定义的 potentially trustworthy origin）。
4. **README 的「双击打开」路径无需废弃。** 用户既能双击打开，也能本地服务打开，两条路都支持文件夹模式。
5. **副产品**：因为 API 是 `[SecureContext]` 门控的，能力探测可以简化为一行——**`typeof showDirectoryPicker === 'function'` 本身就蕴含了「当前是安全上下文」**，不必再判 `isSecureContext`。

> ⚠️ **残留不确定性（必须人工确认）**：headless 造不出真实点击手势，理论上仍可能存在 Chromium 层面的额外限制。**F5-a 的第一个动作就是用真浏览器手动点一次**——已做成工具，见 §3.5。

### 3.5 顺带测出的能力清单（Edge 155.0.4283.45）

`file://` 与 `localhost` 下结果**完全一致**：

| 原型 | 自有方法（`Object.getOwnPropertyNames`） |
|------|------------------------------------------|
| `FileSystemHandle` | `kind, name, isSameEntry, queryPermission, remove, requestPermission` |
| `FileSystemFileHandle` | `createWritable, getFile, move`（`move` 见下方说明） |
| `FileSystemDirectoryHandle` | `getDirectoryHandle, getFileHandle, removeEntry, resolve, entries, keys, values` |
| `FileSystemWritableFileStream` | `write`（已断言；`seek` / `truncate` 未单独断言） |

几个对设计有直接影响的点：

| 能力 | 实测 | 对设计的意义 |
|------|------|--------------|
| `FileSystemFileHandle.prototype.move` | 运行时**存在**（`function`；基类与目录句柄上为 `undefined`） | ⚠️ **但它是非标准的历史遗留、不该用**——见 §3.8。写回不需要它，`createWritable()` 本身就是「写临时文件 → 关闭时替换」 |
| `FileSystemDirectoryHandle.prototype.resolve` | `function` | 可由句柄反算相对路径，作为**文档 id**（§6.2） |
| `encode` 嗅探：`new TextDecoder('utf-8',{fatal:true})` | `ok` | 「严格解码失败即判非 UTF-8」这条防线成立（§6.4） |
| `new TextDecoder('gbk')` | `ok` | 非 UTF-8 文件可**只读预览**，且**无需任何新依赖** |
| `FileSystemObserver` | `function` | F5-d 外部修改检测的原生候选，可替代轮询 |
| `navigator.storage.getDirectory`（OPFS） | `function` | 可选：草稿暂存（本期不用） |
| `input[webkitdirectory]` | `true`（**三个上下文全为 true，含非安全的 C**） | 只读降级路径不受安全上下文限制（§4.1） |
| `structuredClone` / `indexedDB` | `function` / `object` | 句柄可 structured-clone 进 IndexedDB，支撑「最近打开的文件夹」（§6.6） |

### 3.6 ⚠️ 顺带修正 F1 里的一条旧表述

ROADMAP **F1** 中写：

> **坑**：Clipboard API 要求安全上下文（HTTPS 或 `localhost`）。README 目前允许以 `file://` 直接双击打开，该场景下 API 不可用，必须保留 `document.execCommand('copy')` 降级路径。

本次实测**与此不符**：`file://` 是安全上下文，`navigator.clipboard.writeText` 在场景 A 为 `function`（场景 C 才是 `undefined`）。

→ **F1 落地时需复核该结论。** 不过 `execCommand` 降级路径**仍建议保留**——因为 clipboard 写操作除了安全上下文，还要求 transient activation 与文档聚焦，失败面比「安全上下文」这条更宽。这条修正只影响「降级路径的理由」，不影响「要不要留降级路径」。

### 3.7 可复现的验证工具

以上结论已固化为一个**可直接打开的工具**（不在仓库内，与既有测试脚本同目录）：

```
.workbuddy/tools/fsa-probe.html
```

用 Edge / Chrome **直接双击**打开，按 ①②③④ 顺序各点一次，即可自动完成：

| 步骤 | 作用 |
|------|------|
| 0 | 自动列出环境与原型清单（等价于 §3.3 / §3.5 的表） |
| ① | **真实点击**触发 `showDirectoryPicker()` → 回答 §3.4 的残留不确定性 |
| ② | 写入 → 关闭 → 回读比对 → 删除，验证写回全链路 |
| ③ | 创建两个文件后 `move()` 覆盖（**已失去必要性**，见 §3.8；这一步留着只为核对 Chromium 的遗留行为） |
| ④ | 离线自测编码嗅探（ASCII / UTF-8 / UTF-8+BOM / GBK / UTF-16LE） |

> ②③ 会在选中目录里创建 `__mdtu_probe_*` 临时文件并自行清理——**请选一个无关紧要的临时目录**。
> 步骤 ③ 的结果只需回填到 §3.8；§6.3 已不再依赖它。

### 3.8 ⚠️ `move()` 不能用，而 `createWritable()` 已经够用（2026-10-14 复核）

§3.5 观察到 Edge 的 `FileSystemFileHandle.prototype.move` 是个 `function`，于是原方案打算用「写 `xxx.md.tmp` → `move()` 覆盖」来做近似原子写入。**复核后这条路线应当放弃**：

| 检查点 | 结果 |
|--------|------|
| WHATWG File System 现行标准 | `FileSystemHandle` 只有 `isSameEntry()`；`FileSystemFileHandle` 只有 `getFile()` / `createWritable()` / `createSyncAccessHandle()`。**没有 `move()`** |
| MDN `FileSystemHandle` 方法表 | `isSameEntry` / `queryPermission` / `remove` / `requestPermission`——**没有 `move()`** |
| MDN `/Web/API/FileSystemFileHandle/move` | **页面已不存在**（404）。该方法属于 WICG 时代的实验性 API，只在 Chromium 里落地过，后来被撤回 |

也就是说：`move()` 是 Chromium 里的一枚**历史遗留函数**，不是标准的一部分，行为与去留都不受承诺——拿它做数据安全的支点不合适。

**而真正要的那件事，`createWritable()` 本身就做了。** MDN 对 `createWritable()` 的原文：

> Any changes made through the stream won't be reflected in the file represented by the file handle until the stream has been closed. **This is typically implemented by writing data to a temporary file, and only replacing the file represented by file handle with the temporary file when the writable file stream is closed.**

即：写入先落在临时文件里，`close()` 那一刻才替换目标文件。§6.3 的 `saveDoc()` 已经是这个形状（`createWritable()` → `write()` → `close()`），**不需要额外写 `.tmp`、更不需要 `move()`**。F5-b 反而因此简化了一条。

> 顺带：`mode` 选项值得用起来——`createWritable({ mode: 'exclusive' })` 时，第二个写入者会拿到 `NoModificationAllowedError`，正好把「同一个文件在两个标签页里同时写」这件事从静默互相覆盖变成显式报错。

---

## 4. 方案选型

### 4.1 三条候选路径

| 路径 | API | 能力 | 兼容面 | 结论 |
|------|-----|------|--------|------|
| **主路径** | File System Access API（`showDirectoryPicker`） | 枚举 + 读 + **写** + 新建 + 重命名 + 删除 | 仅 Chromium 系（Chrome / Edge） | **采用**——唯一能写回磁盘的浏览器 API |
| 只读降级 | `<input type="file" webkitdirectory>` | 仅枚举与读取 | **全浏览器**（实测非安全上下文下也可用） | 采用，作为读能力的最低保障 |
| 兜底 | 现有单文档模式 | 维持现状 | 全浏览器 | 保留，不删除 |

### 4.2 为什么主路径没有别的选择

「写回磁盘上的原文件」只有 FSA 能做到。其余看似相近的方案都不成立：

| 方案 | 为什么不行 |
|------|------------|
| `webkitdirectory` | 只给 `File` 对象（只读快照），**没有写回通道**，也拿不到目录句柄 |
| `File System Access` 之外的 File API | 同上，浏览器沙箱不允许网页写任意路径 |
| OPFS（`navigator.storage.getDirectory`） | 是浏览器私有的虚拟文件系统，**不是用户的真实目录** |
| Electron / 本地服务端 | 破坏「纯静态三文件、双击即跑」（DESIGN §2），直接出局 |

### 4.3 渐进增强策略

三层探测，逐层降级，**任何一层都不得破坏更低层**：

```
① typeof showDirectoryPicker === 'function'   → 完整模式（读 + 写 + 文件管理）
        ↓ 否
② 'webkitdirectory' in input                  → 只读模式（文件树 + 切换，不能写回）
        ↓ 否（实际上恒为真）
③ 现有单文档模式                                → 原样，UI 不露出新入口
```

**探测只需判 API 是否存在**——由 §3.4 结论 5，`[SecureContext]` 门控使这一行同时覆盖了安全上下文判断。探测失败时**新入口整体不渲染**，而不是渲染出来再报错。

---

## 5. 总体设计

### 5.1 分层改动面

```
【不改】渲染层 —— 全部零改动
    renderMarkdown() · 4 套主题 · Front Matter「属性」面板 · 水印
    外链转脚注 · 大纲 · 字数统计 · 自动编号 · 复制到公众号
                            ▲
            唯一接口： editor.value = N;  renderMarkdown();
                            │
【要改】状态与 IO 层 —— 真正的单文档假设
    saveContent() / loadContent()    app.js:2036 / 2040   → 按文档 id 存取
    editor 'input' → saveContent()   app.js:1383          → 增加脏标记
    Ctrl+S                           app.js:1913          → 写回磁盘
    btnOpenFile / fileInput          app.js:1515–1537     → 保留为兜底入口
    readAsText(file, 'utf-8')        app.js:1535          → BOM 嗅探 + 严格解码
                            │
【要新建】文件系统层 + UI 层
    fs-workspace   目录枚举（懒加载 / 忽略规则）· 读 · 写 · 改名 · 删除
    doc-registry   当前文档 / 脏标记 / 草稿暂存 / 最近打开
    file-tree UI   文件树（复用 .outline-panel 浮层模式）
    冲突检测       焦点 / 切换时机校验 lastModified
```

### 5.2 UI 结构

推荐**左侧毛玻璃抽屉 + 可折叠**，默认收起，不挤压既有双栏：

```
📝 Markdown-Editor   [大纲][…]        [打开文件夹▾] [打开文件] [复制]     ← 顶栏
                                           ↑ 新增
┌─ 文件树抽屉（新增）          ┌─ 编辑面板 ────────       ┊  ┌─ 预览面板 ──────
│  默认收起 / 可拖宽            │  textarea 编辑器         ┊  │  markdown-body
│  ▸ posts/                    │                          ┊  │
│    · a.md  ●                 ├─ 状态栏 1,024 字 ──────   ┊  │
│  ▸ notes/                    │                          ┊  │
│    · x.md                    │                          ┊  │
└─────────────────             └───────────────           ┊  └─────────────

● = 有未保存改动          （为清晰起见只画左边框，实际为完整分栏布局）
```

| 要点 | 说明 |
|------|------|
| 入口 | 顶栏右侧，紧邻现有「打开文件」；文案「打开文件夹」 |
| 抽屉 | 复用 `.outline-panel` 的浮层模式与 `.resizer` 的拖拽逻辑，**不新造第三栏骨架** |
| 当前文档 | 高亮 + 脏标记圆点 `●` |
| 默认收起 | 契合「UI 精简、避免重复切换」的既有取向；单篇写作时完全不打扰 |
| 降级提示 | 探测不到 API 时，「打开文件夹」按钮**不渲染**（而非置灰） |

### 5.3 「实时」拆成两件事

| | 实时 1：本地写回 | 实时 2：跟随外部改动 |
|---|---|---|
| 含义 | 我在编辑器里改了 → 写回磁盘 | 磁盘被 VS Code / `git checkout` 改了 → 我知道 |
| 触发 | `input` 防抖（`debounce` 现成，app.js:220）或 `Ctrl+S` | 窗口重新聚焦 / 切换文件 / （可选）`FileSystemObserver` |
| **风险** | **高**——真正的磁盘覆盖，FSA **无事务、无回滚** | 低——只读检测 |
| 归属 | F5-b | F5-d |

**建议默认：`Ctrl+S` 显式保存，自动写回做成可开关选项（默认关）。** 理由：这是唯一会不可逆破坏用户数据的路径，而项目连 F1 导出都还没做——说明这些文件的副本全在磁盘上，覆盖错了就是没了。让用户先手动确认几次，比默认自动更负责。

---

## 6. 详细设计

### 6.1 目录枚举（F5-a）

```js
async function walk(dirHandle, relPath, out) {
  for await (const [name, handle] of dirHandle.entries()) {   // entries() 已实测可用
    if (shouldIgnore(name, handle.kind)) continue;
    const p = relPath ? relPath + '/' + name : name;
    out.push({ name, kind: handle.kind, path: p, handle });
    // 子目录不在此处递归 —— 懒加载：只在用户点开时才展开
  }
}
```

| 设计点 | 决策 |
|--------|------|
| **懒加载** | 只枚举「已展开」的目录。顶层的直接子项先给，子目录点开才枚举——否则几千文件的目录会直接卡死 UI |
| **忽略规则** | 默认 `node_modules` / `.git` / `dist` / `build` / `out` / `.next` / `.venv` / `__pycache__` / `.DS_Store`；目录名命中即整棵剪掉 |
| **扩展名** | 文本类（`.md .markdown .mdx .txt`）正常显示；其他文件**灰显**（可切换为隐藏），避免把整个目录的杂物铺满树 |
| **排序** | 目录在前、文件在后；同组内 `localeCompare(b, 'zh', {numeric:true})`——`numeric` 必需，否则 `第10章` 会排在 `第2章` 前面 |
| **空目录** | 显示为 `(空)` 占位，避免看起来像加载失败 |
| **超时/失败** | 单个子目录枚举失败（权限/占用）时局部标红，**不中断整棵树** |

### 6.2 文档模型与持久化（F5-b）

#### 文档 id

用**工作区内的相对路径**作 id（`posts/2026/hello.md`），因为：

- 树内唯一（`handle.name` 不唯一）；
- 可读、可直接用于 UI 与「最近打开」；
- `FileSystemDirectoryHandle.resolve(handle)` 已实测可用，可由句柄反算路径，与遍历时记录的路径互为校验。

> ⚠️ 重命名文件时要**同步迁移**所有以旧路径为键的状态（草稿、最近打开），否则会留下永远不生效的孤儿草稿——这是这类设计最常见的 bug。

#### 持久化的核心决策：**不缓存磁盘上已存在的内容**

localStorage 有约 5 MB 上限，把整个 vault 缓存进去必然爆。但既然文件本来就在磁盘上，**根本不需要缓存已保存的内容**——只需要暂存「还没写回磁盘的草稿」。

| 数据 | 存储位置 | 说明 |
|------|----------|------|
| 已保存的正文 | **不存** | 直接读磁盘 |
| 未保存草稿（`dirty` 的文档） | `localStorage['mdtu-workspace']` | 只存这些，体积极小 |
| 当前文档 / 最近打开 | 同上 | 刷新后恢复用 |
| 目录句柄本身 | **IndexedDB** | `FileSystemHandle` 不能 JSON 序列化，但可 structured-clone（实测 `structuredClone` 可用）。刷新后仍**需用户手势重新授权** |

```jsonc
// localStorage['mdtu-workspace']
{
  "folderName": "my-vault",
  "lastPath": "posts/hello.md",
  "recent": ["posts/hello.md", "notes/x.md"],
  "drafts": {
    "posts/hello.md": { "content": "…未保存的正文…", "savedAt": 1760000000000 }
  }
}
```

| 兼容性 | 处理 |
|--------|------|
| 单文档模式 | **原样保留** `mdtu-content` 与 `loadContent()` / `saveContent()`，不动 |
| 进入文件夹模式 | 切换到 `mdtu-workspace`；`mdtu-content` 冻结不再写入 |
| 退出文件夹模式 | 若有 `drafts`，提示「还有 N 篇未保存草稿」再退出 |
| 草稿超限 | `localStorage` 写满时（`QuotaExceededError`）降级为「仅内存」，并明确提示「刷新将丢失未保存改动」 |

### 6.3 写回（F5-b）

```js
async function saveDoc(path, text) {
  const fh = await resolveFileHandle(path);
  // 换行符还原（见 §6.4）
  const out = eol.restore(text);
  // createWritable() 本身就是「写临时文件 → close() 时替换目标」，
  // 所以下面三行已经是近似原子写入，不需要先写 .tmp 再改名（§3.8）
  const w = await fh.createWritable();
  await w.write(out);
  await w.close();
}
```

| 决策 | 内容 |
|------|------|
| **默认行为** | `Ctrl+S` 显式保存（§5.3） |
| **自动写回** | 可开关，**默认关**；开启后走 `debounce` 800–1200ms |
| **`.bak` 保护** | 首次接管某文件时先写一份 `xxx.md.bak` 一次（已存在则不覆盖） |
| **落盘方式** | 只用 `createWritable()` → `write()` → `close()`。MDN 明确「实现上就是先写临时文件、`close()` 时替换」——**这就是近似原子写入**，不需要 `move()`（§3.8 已论证 `move()` 非标准、不该依赖） |
| **多标签页同写** | `createWritable({ mode: 'exclusive' })`：第二个写入者拿到 `NoModificationAllowedError`，把静默互相覆盖变成显式报错 |
| **写失败** | 保持 `dirty` 状态不摘除，Toast 报错，**绝不静默吞掉** |
| **只读兜底** | 用 `webkitdirectory` 路径进来的会话，保存入口置灰并提示原因 |

### 6.4 编码与换行符（F5-b，**数据安全的重点**）

现状 `reader.readAsText(file, 'utf-8')`（app.js:1535）**已经把 GBK 文件读成乱码**了。文件夹模式要写回，这个坑会从「看着难受」升级为「**把用户原文件毁掉**」，必须一并解决。

#### 读取流程

```js
const buf   = await (await fh.getFile()).arrayBuffer();
const bytes = new Uint8Array(buf);

// ① BOM 嗅探（优先级最高）
//    EF BB BF → UTF-8 | FF FE → UTF-16LE | FE FF → UTF-16BE

// ② 无 BOM：严格 UTF-8 解码
try {
  text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);   // 实测该构造可用
  encoding = 'utf-8';
} catch {
  // ③ 解码失败 → 判为非 UTF-8（如 GBK）
  encoding = 'non-utf8';
}
```

| 判定 | 行为 |
|------|------|
| UTF-8（含 BOM） | 正常读写 |
| UTF-16（含 BOM） | **只读打开 + 提示**（本期不写回） |
| 非 UTF-8（严格解码失败） | **只读打开 + 提示**，并提供「按 GBK 预览」——`TextDecoder('gbk')` 实测可用，**零新增依赖** |

> **安全红线**：只要 `encoding === 'non-utf8'`，**写回通道必须关闭**。宁可不给写，也不能把用户的原文件替换成乱码。这条要在代码里做成显式状态判断，而不是靠注释约定。

#### 换行符

| 事实 | 后果 |
|------|------|
| `<textarea>.value` 按 HTML 规范一律返回 `\n` | 读进来时 CRLF 信息**已经丢了** |
| 因此必须在**读入的瞬间**把原始行尾记下来 | 否则写回时整个文件 diff 全红 |

处理：

1. 解码后先统计 `\r\n` 与裸 `\n` 的数量，判定主行尾（`crlf` / `lf`）；
2. 记录原文件**末尾是否有换行**；
3. 写回时按记录还原（LF → CRLF）。

> 同样地，**文件末尾的空行也属于原文内容**——`splitFrontMatter` 的既有实现（app.js:379 起）已容忍 `\r?`，但写回是另一条路径，需独立处理。

### 6.5 外部修改检测（F5-d）

| 手段 | 现状 | 取舍 |
|------|------|------|
| 轮询 `getFile().lastModified` | 哪都能用，但要定频率（1–2s），大目录是负担 | **不采用** |
| **焦点 / 切换时机校验** | 零成本 | **采用**——只在「窗口重新获得聚焦」与「切换文档」两个时机校验 `lastModified`，与打开时记录的值比对 |
| `FileSystemObserver` | 实测 `function`（Edge 155） | 作为**可选增强**：能 feature-detect 就订阅，否则退回上面的时机校验 |

冲突处理（`lastModified` 不一致时）：

| 选项 | 行为 |
|------|------|
| 重新载入 | 丢弃本地改动，读磁盘版本 |
| 保留我的版本 | 维持编辑区内容，下次保存时覆盖磁盘 |
| （不做）查看差异 | **本期不做**——等于内置一个 diff 视图，属于范围外 |

> **不做自动合并。** 三方合并是独立课题，且与「非目标：版本历史交给 git」冲突。

### 6.6 权限与会话恢复

| 问题 | 设计 |
|------|------|
| 刷新后句柄还在吗？ | 在——句柄存 IndexedDB（structured-clone）可恢复 |
| 刷新后还能直接读吗？ | **不能**——权限不持久，`requestPermission({mode:'readwrite'})` 必须由**用户手势**触发 |
| 怎么恢复体验？ | 启动时检查 IndexedDB 里的最近句柄，树先渲染为「待授权」态，用户点一下「恢复访问」即回到 `lastPath` |
| 权限状态查询 | `queryPermission({mode:'readwrite'})` 已实测可用，用于决定按钮是「恢复访问」还是直接可用 |

### 6.7 与既有功能的联动

| 既有功能 | 联动 | 需要改动吗 |
|----------|------|------------|
| 预览 / 主题 / 元数据 / 水印 / 外链转脚注 | 换 `editor.value` 后自动全部跟随 | **否**（§2.2） |
| 大纲 / 字数统计 / 自动编号 | 由 `renderMarkdown()` 派生，自动跟随 | **否** |
| 同步滚动 / 分栏比例 | 切文档后应重置到顶部（沿用 F4 的既有修正：`init()` 里显式回顶） | 是，一处 |
| 模板 / 主题 / 页宽 / 水印配置 | 保持**全局**设置，不随文档变化 | 否（仅需确认语义） |
| 复制到公众号 | 完全不受影响 | **否** |
| 打开文件（单文档） | 保留为兜底入口 | 否 |
| F1 导出 | 导出「当前文档」；文件名取文档名 | F1 落地时衔接 |
| `Ctrl+S` | 文件夹模式下写磁盘；单文档模式仍写 localStorage | 是 |
| 顶栏按钮数 | 净增 1（「打开文件夹」）——注意别让顶栏继续膨胀 | 是 |

### 6.8 新建代码的组织

保持项目既有的「单文件 IIFE + 模块化函数」风格（DESIGN §3.2），建议分三组：

| 组 | 职责 | 关键函数 |
|----|------|----------|
| `fs-workspace` | 文件系统访问 | `pickFolder()` / `listDir(handle)` / `readFile(handle)` / `writeFile(handle, text)` / `renameFile()` / `removeFile()` |
| `doc-registry` | 文档状态 | `openDoc(path)` / `closeDoc()` / `markDirty()` / `saveCurrent()` / `restoreSession()` |
| `file-tree` | UI | `renderTree()` / `toggleDir()` / `setActive()` |

> **F5-a 实际落地的命名**（同一段 `// ===== F5：文件夹模式（只读）=====` 内，未拆成三个对象）：
> `pickFolder()` / `listChildren(dirHandle, basePath)` / `buildSnapshotTree(files)` / `readNodeText(node)` / `decodeBytes(bytes)` / `renderTree()` / `buildRow()` / `appendRows()` / `noteRow()` / `toggleDir(node)` / `openTreeNode(node)` / `findNode(path)` / `setTreePanel(show)` / `requestFolder()` / `initFolderMode()`，状态集中在 `treeState`。
> 写盘相关（`writeFile` / `renameFile` / `removeFile`）**本期一个都没写**，等 F5-b/c。

---

## 7. 风险与边界

### 7.1 风险清单

| # | 风险 | 影响 | 缓解 |
|---|------|------|------|
| 1 | **写回覆盖不可逆** | **极高**（丢用户数据） | `Ctrl+S` 默认手动；首次接管写 `.bak`；落盘走 `createWritable()` 的「临时文件 → close 替换」（§3.8）；`mode: 'exclusive'` 挡住多标签页同写；不静默吞错 |
| 2 | **非 UTF-8 文件被写回** | **极高**（原文件变乱码） | 严格解码失败即**关闭写回通道**，只读打开（§6.4 红线） |
| 3 | 换行符未保留 | 中（整个文件 diff 全红） | 读入瞬间记录主行尾与末尾换行（§6.4） |
| 4 | 权限不持久导致体验割裂 | 中 | 「最近打开的文件夹」+ IndexedDB 句柄 + 一键恢复访问 |
| 5 | 大目录卡死 | 中 | 懒加载 + 忽略规则（§6.1） |
| 6 | 与外部编辑冲突 | 中 | 焦点/切换时机校验 + 二选一提示（§6.5） |
| 7 | 兼容面窄（仅 Chromium） | 中 | 三层渐进增强，探测失败时入口不渲染（§4.3） |
| 8 | 与 F1/F2/F3 抢精力 | 中 | **建议只做 F5-a 验证价值**（§8） |

### 7.2 边界声明

| 边界 | 判定 |
|------|------|
| 与「非目标：云同步」 | **不冲突**——F5 纯本地，零后端 |
| 与「非目标：多人协作」 | **不冲突** |
| 与「非目标：版本历史」 | **明确不做**。文件一旦落盘就交给 git 管理；F5-d 只做**冲突提示**，不做历史回溯、不做自动合并、不做滚动快照 |
| 与「微信优先」核心定位 | **不改变**——公众号排版链路零改动（§6.7） |
| 图床 / 图片粘贴 | **不在本期**——仍是独立立项（与 F2 一致） |

---

## 8. 分期落地与验收

### 8.1 分期

| 阶段 | 内容 | 依赖 | 风险 | 交付价值 | 状态 |
|------|------|------|------|----------|------|
| **F5-a** | 打开文件夹（**只读**）：文件树 + 切换文档 + 三层探测降级 | 无 | 零（不碰磁盘） | 一次看到整个 vault，**立刻可用** | ✅ 已完成 |
| F5-b | 写回：`Ctrl+S` + 脏标记 + 编码/换行安全线 + `.bak` + 权限恢复 | 无 | **最高** | 才叫「实时编辑」 | ⬜ 待做 |
| F5-c | 文件管理：新建 / 重命名 / 删除 + 忽略规则面板 | F5-a | 中 | 完整工作区 | ⬜ 待做 |
| F5-d | 外部修改检测 + 冲突提示 | F5-b | 中 | 多工具并用不打架 | ⬜ 待做 |

**为什么先只做 F5-a**：它风险为零（只读）、交付最快，且能**立刻回答「文件夹模式是不是真的一直在用」**。若用一阵子发现没在用，后面 b/c/d 就不必做——这比一次铺开四期再回滚便宜得多。

### 8.2 各期验收标准

**F5-a**

1. `file://` 与 `localhost` 两种打开方式下「打开文件夹」均可用（**真浏览器手动确认**）
2. 打开含 500+ 文件的目录不卡顿（懒加载生效）
3. 切换文档后预览、大纲、字数统计、元数据面板全部跟随切换，且**渲染层代码零改动**
4. 不支持该 API 的浏览器（Firefox / Safari）保持现有单文档模式，**功能不退化**
5. 单文档模式的所有既有能力（模板 / 水印 / 复制 / 外链转脚注）不受影响

**F5-b**

6. `Ctrl+S` 写回后，用外部编辑器打开该文件内容一致，**换行符与原文相同**
7. 非 UTF-8（GBK）文件只读打开并提示，**绝不被写回覆盖**
8. 首次接管某文件时有 `.bak` 兜底
9. 写失败时 `dirty` 标记不摘除，且有明确错误提示
10. 刷新页面后「最近打开的文件夹」入口可用，重新授权后回到原文档

**F5-c / F5-d**

11. 新建 / 重命名 / 删除均有二次确认；重命名后草稿与「最近打开」正确迁移
12. 磁盘被外部修改后切回该文档，给出「重新载入 / 保留我的版本」提示
13. 忽略规则生效：`node_modules` / `.git` 不出现在树中

---

## 9. 待决问题

### 9.1 需要用户拍板的三件事

| # | 问题 | 选项 | 我的建议默认值 | 用户决定（2026-10-13） |
|---|------|------|----------------|------------------------|
| 1 | **F5 的定位** | 「偶尔翻一下 vault」/ 「当主力编辑器」 | **先按「偶尔翻」做**（只做 F5-a），用一阵子再决定要不要 b/c/d | ✅ **采纳建议：先只做 F5-a** |
| 2 | **写回默认行为** | `Ctrl+S` 显式保存 / 自动写回 | **`Ctrl+S` 显式保存**；自动写回做成开关且默认关 | ✅ **采纳建议**（F5-b 落地时按此实现） |
| 3 | **是否接受「需要安全上下文」这一点** | 接受（`localhost` 或 `file://` 均可）/ 不接受 | **接受**——§3 已实测 `file://` 可用，「双击打开」路径不必废弃，门槛并未升高 | ✅ **采纳建议** |

> 本文其余部分按上表默认值撰写。任一项改主意，需同步修订 §5.3、§6.3 与 §8。
>
> 另有一项交互决定：**文件树做成左侧毛玻璃抽屉、默认收起**（用户选定），复用 `.outline-panel` 的浮层骨架，不新造第三栏。

**2026-10-14 追加的三项决定**（第一版 F5-a 落地后用户提出）：

| # | 问题 | 用户决定 |
|---|------|----------|
| 4 | 「打开」与「文件夹」两个顶栏按钮怎么摆 | **收进一个下拉**，菜单项改叫「**文件**」「**文件夹**」——顶栏不再横向膨胀（§11.3 / §11.5） |
| 5 | 切换文档之后的存档 | **沿用 `saveContent()`**（写 `mdtu-content`，刷新仍停在这篇）；F5-b 再换成「按文档存取」的持久化层（§11.2） |
| 6 | 抽屉与树的显示控制 | 抽屉要**能收也能拉回来**（菜单开关 + `×` + 左缘把手）；树要**全部展开 / 全部收起**（§11.5） |

### 9.2 需要在实现中实测确认的

| # | 待确认 | 何时确认 |
|---|--------|----------|
| 1 | ~~`move()` 在**目标已存在**时是覆盖还是报错~~ **已消解**：`move()` 非标准、不该用；`createWritable()` 自带「临时文件 → close 替换」（§3.8） | 不需要了 |
| 2 | `createWritable()` 中断后目标文件的残留状态 | F5-b 中 |
| 3 | 大目录（5000+ 文件）下 `entries()` 的实际耗时 | F5-a 中 |

### 9.3 已经在本文里解决掉的（记录以免重复讨论）

| 曾经的疑问 | 结论 | 依据 |
|------------|------|------|
| `file://` 下能不能用？ | **能** | §3.3 三组对照实测 |
| 需不需要额外依赖？ | **不需要**，含 GBK 解码 | §3.5 |
| 有没有原子写入的可能？ | **有**，而且是现成的：`createWritable()` 先写临时文件、`close()` 时替换目标 | §3.8（`move()` 那条路已废弃） |
| 文件树要不要新造侧栏？ | **不要**，复用 `.outline-panel` 模式 | §2.3 / §5.2 |
| 要不要缓存整个 vault？ | **不要**，只存未保存草稿 | §6.2 |

### 9.4 ✅ 动手前必须做的第一件事（已完成）

> **用 Edge 打开 `.workbuddy/tools/fsa-probe.html`，点第 ① 步。**

§3 的实测是在 headless 下做的——它能证明「API 暴露且只卡在用户手势」，但**造不出真实点击手势**。所以严格来说，「`file://` 下目录选择器真的能弹出来」还没有被直接观察到。

**结论（2026-10-13）**：用户已手动确认可用 → §3.4 的结论 4 成立，README 的「方式二：直接双击打开」**无需附加说明**，F5-a 直接开工。

> ⚠️ 注意：本条只解决了「真机能否弹出目录选择器」。F5-a 的自动化回归（`fs-test.js` 的 C 段）用的是**打桩的假文件系统**，它能验证树逻辑与抽屉几何，但**验证不了真实磁盘的权限行为**——那部分仍需人工试一次。

---

## 10. 参考

- [MDN：File System Access API](https://developer.mozilla.org/zh-CN/docs/Web/API/File_System_API)
- [MDN：window.showDirectoryPicker()](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/showDirectoryPicker)
- [MDN：FileSystemFileHandle.createWritable()](https://developer.mozilla.org/zh-CN/docs/Web/API/FileSystemFileHandle/createWritable)——「先写临时文件、`close()` 时替换」那句原文在这里（§3.8）
- [MDN：FileSystemHandle](https://developer.mozilla.org/zh-CN/docs/Web/API/FileSystemHandle)——现行方法表里**没有 `move()`**（§3.8）
- [MDN：FileSystemHandle.requestPermission()](https://developer.mozilla.org/zh-CN/docs/Web/API/FileSystemHandle/requestPermission)
- [MDN：FileSystemObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/FileSystemObserver)
- [web.dev：The File System Access API](https://web.dev/articles/file-system-access)
- [HTML 规范：potentially trustworthy origin](https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy)
- [HTML 规范：textarea 的 API value 使用 LF](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-textarea-element)
- 项目内文档：[README.md](./README.md) ｜ [DESIGN.md](./DESIGN.md) ｜ [ROADMAP.md](./ROADMAP.md)

---

## 11. 落地记录（F5-a，2026-10-13；2026-10-14 修订）

### 11.1 落地面

| 文件 | 改动 |
|------|------|
| `index.html` | 顶栏「打开」下拉（`#openWrap` / `#btnOpen` / `#openMenu`，内含 **`#btnOpenFile`（文件）** 与 **`#btnOpenFolder`（文件夹）**；后者默认 `hidden`，能力不足时连节点一起摘掉）+ 只读降级用的 `#folderInput[webkitdirectory]` + 左侧抽屉 `#fileTreePanel`（标题栏带「全部展开 / 全部收起 / 选择文件夹 / `×`」）+ 抽屉收起后的左缘把手 `#treePeek` |
| `css/style.css` | 新增 `/* ===== F5：文件树抽屉 =====` 段（复用 `.outline-panel`，覆盖成左侧毛玻璃抽屉 + 行样式 + 宽度把手 + 把手 `.tree-peek`）+ `#openWrap.single .export-caret`；**顺带修掉顶栏溢出**（见 11.3） |
| `js/app.js` | 末尾新增 `// ===== F5：文件夹模式（只读）=====` 段（约 500 行），并在 `init()` 里调一次 `initFolderMode()`；「打开」下拉的开关逻辑在 `setOpenMenu()` 附近 |
| `.workbuddy/tools/fs-test.js` | 新增回归套件（初版 104 条，修订后 **155 条**；工具目录，不进仓库） |

### 11.2 与规划的差异（都是有意的）

| 规划 | 实际 | 原因 |
|------|------|------|
| 只做「完整模式 + 只读降级」两层的 UI 分叉 | **只读快照模式也实现了完整交互**（`<input webkitdirectory>` 的扁平列表按 `webkitRelativePath` 补成树，叶子挂 `File` 对象） | 成本极低（三十行），却让 Firefox / Safari 用户也能用上「文件树 + 切换」，而不是完全没入口 |
| 编码处理（§6.4）归 F5-b | **读侧判据提前到 F5-a** | 不提前做，GBK 文件在树里打开就是乱码；「严格解码失败即判非 UTF-8」这条判据同时是 F5-b 关闭写回通道的依据，先定下来更省事 |
| §6.1 的忽略/排序/空目录/失败占位 | 全部落地 | — |
| §6.1「非文本文件可切换为隐藏」 | **不做**，只灰显 | 属于「忽略规则面板」的一部分，随 F5-c 一起做 |
| §6.7「切换文档含未保存内容确认」 | **不做确认** | 本期不写盘，切换不会丢任何已存盘内容，每次点文件都弹一次确认反而碍事；F5-b 随脏标记一起做 |
| §6.2 的「文档 id / 草稿暂存 / 最近打开」 | **不做** | 都属于 F5-b 的持久化层；本期切换后仍走 `saveContent()` 写 `mdtu-content`，刷新停在这篇（**2026-10-14 用户确认沿用此做法**） |
| §5.2 的「默认收起 + 可拖宽」 | 落地 | 宽度存 `mdtu-tree-width`（180–640px） |

### 11.3 顺带修掉的既有回归：顶栏溢出

实测 1280px 宽下 `.app-header` 是 `scrollWidth 1395 / clientWidth 1248`——**在 F5 之前**，`#btnExport` 与 `#btnCopy` 就已经落到可视区之外了。新增「文件夹」入口后又把「外链转脚注」挤了出去。

两步修法：

1. **布局兜底**：`.header-left` / `.header-right` 设 `flex-shrink: 0`，`.header-center` 加 `min-width: 0; overflow-x: auto; justify-content: safe center`——中间那组退化成可横向滚动的条，右侧主操作永不缺席。`safe` 关键字是必需的：居中溢出会把左端裁掉且滚不回去。这条与 `.editor-toolbar` 的既有做法一致，已写进 DESIGN §5.1。
2. **入口收拢（2026-10-14）**：把「打开」与「文件夹」两个按钮收进一个**下拉**（「打开 → 文件 / 文件夹」），顶栏按钮数回到 F5 之前的水平——**根治**了「每加一个入口就挤掉一个」这件事，而不是继续靠滚动条兜。

### 11.4 验证

`.workbuddy/tools/fs-test.js`，修订后 **155 条**：

| 段 | 覆盖 |
|----|------|
| A 静态源码断言（34 条） | 入口 / 抽屉 / 三层探测 / 忽略清单 / `numeric` 排序 / 严格 UTF-8 判据 / **「代码里不得出现任何写盘 API」**（`createWritable`、`removeEntry`、`requestPermission`… 逐条断言不存在） |
| B jsdom 端到端（43 条） | 把 `showDirectoryPicker` 打桩成内存假文件系统，走真实点击路径：建树 → 懒加载（用「未展开目录的枚举次数为 0」证明）→ 展开 / 收起 → 非文本灰显 → 切文档且预览跟随 → BOM / GBK 解码 |
| C 真实 Edge（78 条） | 抽屉锚位（落在顶栏下方、不溢出视口、默认 264px）、毛玻璃生效、缩进随层级递增、**同级目录与文件的图标 / 文字对齐**、真实浏览器里点文件确实换正文、**顶栏按钮全在可视区内且互不重叠**、抽屉的开关 / 把手 / 全部展开收起、**全屏时设备档隐藏且正文仍按当前档渲染**、打开文件不弹 Toast |

连同既有四套（`fm-unit` 95 + `fm-e2e` 87 + `bq-test` 58 + `ex-test` 225），**合计 620 条断言，0 失败**。C 段顺带产出一张 `shots/fs-tree.png` 供人工核观感（脚本会打桩一个假文件系统，所以图上的树是构造出来的样本，不是真实磁盘）。

### 11.5 修订记录（2026-10-14）

第一版把「文件夹」直接摆在顶栏上，结果是顶栏净增一个按钮、挤掉「外链转脚注」。这一轮做了五处调整，**都是用户当轮明确提出的**：

| # | 用户要求 | 落地 |
|---|---------|------|
| 1 | 「把文件夹和打开收进下拉，并改为『文件、文件夹』」 | 新增「打开」下拉（`#openWrap`），内含「文件」「文件夹」两项，复用 `.export-*` 骨架；能力不足时只剩「文件」一项并收掉箭头 |
| 2 | 「打开文件时不需要 toast 提示」 | 单文件打开与树里切换文档都不弹。**唯一例外**是编码：非 UTF-8（GBK 回退）/ UTF-16 只读预览时必须提示 |
| 3 | 「全屏预览时隐藏掉设备列表，全屏时默认按当前选择的设备」 | `enterFullscreen()` 隐藏 `#previewModeGroup`；页宽组只在 PC 档出现（iPad / APP 的版心由 `--dev-max` 决定，inline `max-width` 会压掉它），非 PC 档进入时清掉遗留的 inline `max-width` 与 `page-mode`。`.device-*` class 全程不摘，所以「按当前档渲染」不需要额外代码 |
| 4 | 「左侧文件树面板增加隐藏和显示控制」 | 三条路：菜单项开关（带 `.active`）、标题栏 `×`、**收起后左缘把手 `#treePeek`**（只在「有工作区 + 已收起」时出现） |
| 5 | 「文件树增加收起和展开」 | 标题栏「全部展开 / 全部收起」。收起 = 清空展开集合（不必重读盘）；展开 = 逐个读盘，`TREE_EXPAND_MAX = 400` 封顶并在到顶时如实告知，每 20 个重绘一次 |

**顺带定死的一件事**：切换文档后仍调用 `saveContent()`（写 `mdtu-content`，刷新停在这篇）——用户确认沿用，F5-b 再换成工作区存档。

**另有一项方案被简化掉**：`move()` 那条「近似原子写入」路线废弃（§3.8）——它不是标准，MDN 页面已撤下；而 `createWritable()` 本身就是「先写临时文件、`close()` 时替换目标」，F5-b 少写一个 `.tmp` 回合。
