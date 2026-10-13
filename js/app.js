/* ============================================================
 * MDTU 码途编辑器 - 本地版
 * 基于 marked / highlight.js / KaTeX / Mermaid
 * ============================================================ */

(function () {
  'use strict';

  // ===== State =====
  // 已下线主题的旧值 → 收敛到当前可用的主题。用户 localStorage 里可能还留着旧键。
  const THEME_ALIASES = {
    shanchui: 'qingkong',              // 山吹 → 晴空蓝（改名）
    shanyue: 'github',                 // 山月（已下线）
    'condensed-night-purple': 'github', // 凝夜紫（已下线）
  };
  const THEMES = ['github', 'qingkong'];

  function normalizeTheme(t) {
    const v = THEME_ALIASES[t] || t;
    return THEMES.includes(v) ? v : 'github';
  }

  const state = {
    theme: normalizeTheme(localStorage.getItem('mdtu-theme')),
    autoNumber: false,
    gridBg: false,
    syncScroll: true,
    currentTemplate: null,
    footnoteLinks: false,
    // 预览设备档。这里只放默认值，存档值在 init() 里经校验后套用
    // （DEVICE_IDS 是 const，此处还取不到）。
    device: 'pc',
  };

  // ===== Elements =====
  const $ = (sel) => document.querySelector(sel);
  const editor = $('#editor');
  const preview = $('#preview');
  const previewWrap = $('#previewWrap');
  const previewScroll = $('#previewScroll');
  const themeSelect = $('#themeSelect');
  const deviceBtns = document.querySelectorAll('#deviceGroup .seg-btn');
  const charCount = $('#charCount');
  const wordCount = $('#wordCount');
  const lineCount = $('#lineCount');
  const toast = $('#toast');

  const escapeHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ===== Watermark Config =====
  const WM_KEY = 'mdtu-watermark';
  const WM_DEFAULTS = {
    enabled: false,
    text: '',
    color: '#999999',
    fontSize: 16,
    opacity: 12,
    angle: -30,
    gap: 180,
    onCopy: true,
  };

  function loadWatermark() {
    try {
      const saved = JSON.parse(localStorage.getItem(WM_KEY) || '{}');
      return Object.assign({}, WM_DEFAULTS, saved);
    } catch (e) {
      return Object.assign({}, WM_DEFAULTS);
    }
  }

  function saveWatermark() {
    try { localStorage.setItem(WM_KEY, JSON.stringify(watermark)); } catch (e) {}
  }

  let watermark = loadWatermark();

  // Measure text width with a hidden probe (used to size the watermark tile)
  let wmProbe = null;
  function measureTextWidth(text, fontSize) {
    if (!wmProbe) {
      wmProbe = document.createElement('span');
      wmProbe.style.cssText =
        'position:absolute;left:-9999px;top:-9999px;white-space:nowrap;visibility:hidden;' +
        'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;';
      document.body.appendChild(wmProbe);
    }
    wmProbe.style.fontSize = fontSize + 'px';
    wmProbe.textContent = text;
    return wmProbe.offsetWidth || text.length * fontSize * 0.6;
  }

  // Build a repeating SVG tile as a data URI
  function buildWatermarkUrl(cfg) {
    if (!cfg.text || !cfg.text.trim()) return '';
    const text = cfg.text.trim();
    const fontSize = cfg.fontSize;
    const tw = measureTextWidth(text, fontSize);
    const tileW = Math.max(40, Math.round(tw + cfg.gap * 0.5));
    const tileH = Math.max(30, Math.round(fontSize + cfg.gap * 0.5));
    const esc = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + tileW + '" height="' + tileH + '">' +
      '<text x="' + tileW / 2 + '" y="' + tileH / 2 + '" text-anchor="middle" dominant-baseline="central" ' +
      'transform="rotate(' + cfg.angle + ' ' + tileW / 2 + ' ' + tileH / 2 + ')" ' +
      'fill="' + cfg.color + '" fill-opacity="' + (cfg.opacity / 100).toFixed(3) + '" ' +
      'font-size="' + fontSize + '" font-family="sans-serif">' + esc + '</text></svg>';
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  function isWatermarkActive(cfg) {
    return !!(cfg && cfg.enabled && cfg.text && cfg.text.trim());
  }

  function applyWatermark() {
    const uri = isWatermarkActive(watermark) ? buildWatermarkUrl(watermark) : '';
    if (uri) {
      preview.style.backgroundImage = uri;
      preview.style.backgroundRepeat = 'repeat';
    } else {
      preview.style.backgroundImage = '';
      preview.style.backgroundRepeat = '';
    }
    $('#btnWatermark').classList.toggle('active', isWatermarkActive(watermark));
  }

  // Tile the watermark as real DOM nodes inside a container (used for clipboard copy)
  function injectWatermarkNodes(container, cfg) {
    const text = (cfg.text || '').trim();
    if (!text) return;

    const w = container.offsetWidth || 780;
    const h = container.offsetHeight || 1200;
    const fontSize = cfg.fontSize;
    const tw = measureTextWidth(text, fontSize);
    const stepX = Math.max(40, Math.round(tw + cfg.gap * 0.5));
    const stepY = Math.max(30, Math.round(fontSize + cfg.gap * 0.5));

    container.style.position = 'relative';

    const layer = document.createElement('div');
    layer.setAttribute('data-watermark', 'true');
    layer.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;' +
      'pointer-events:none;z-index:9999;';

    const common =
      'position:absolute;white-space:nowrap;pointer-events:none;user-select:none;' +
      'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;' +
      'color:' + cfg.color + ';opacity:' + (cfg.opacity / 100).toFixed(3) + ';' +
      'font-size:' + fontSize + 'px;transform:rotate(' + cfg.angle + 'deg);transform-origin:left top;';

    const frag = document.createDocumentFragment();
    for (let y = 0; y < h + stepY; y += stepY) {
      for (let x = 0; x < w + stepX; x += stepX) {
        const span = document.createElement('span');
        span.textContent = text;
        span.style.cssText = common + 'left:' + x + 'px;top:' + y + 'px;';
        frag.appendChild(span);
      }
    }
    layer.appendChild(frag);
    container.appendChild(layer);
  }

  // ===== Default Content =====
  const defaultContent = `# Markdown-Editor

一款支持微信样式与水印的 Markdown 编辑器。

## 列表

**有序列表**

1. 天干
   1. 甲
   2. 乙
   3. 丙
   4. 丁
2. 地支
   1. 子
   2. 丑
   3. 寅
   4. 卯

**无序列表**

- 天干
  - 甲
  - 乙
  - 丙
  - 丁
- 地支
  - 子
  - 丑
  - 寅
  - 卯

## 引用

> 欲穷千里目，更上一层楼

> > 举头望明月，低头思故乡

## 代码

**内联代码**

\`import\`

**代码段**

\`\`\`js
// 如何实现一个防抖函数
function debounce (f, wait) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => f(...args), wait)
  }
}
\`\`\`

## 标题

以下是关于标题的样式

# 一级标题

## 二级标题

### 三级标题

## 表格

| 功能       | 快捷键          | 说明           |
| ---------- | --------------- | -------------- |
| 粗体       | \`Ctrl+B\`        | **粗体文本**   |
| 斜体       | \`Ctrl+I\`        | *斜体文本*     |
| 链接       | \`Ctrl+K\`        | [链接](#)      |
| 代码块     | \`Shift+Ctrl+C\`  | 行内代码       |

## 数学公式

行内公式：$E = mc^2$

块级公式：

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## 任务列表

- [x] 已完成的功能
- [ ] 待完成的功能
- [ ] 另一个待办

## 分割线

---

> 点击右上角 **复制** 按钮可复制渲染后的内容，直接粘贴到微信公众号编辑器。
`;

  // ===== Marked Configuration =====
  const renderer = new marked.Renderer();

  // Override link renderer to support footnote mode
  const originalLinkRenderer = renderer.link;
  let footnoteCounter = 0;
  let footnoteList = [];

  renderer.link = function (href, title, text) {
    if (state.footnoteLinks && href && /^https?:\/\//i.test(href)) {
      footnoteCounter++;
      const fnId = footnoteCounter;
      footnoteList.push({ id: fnId, href, text });
      const plain = text.replace(/<[^>]+>/g, '');
      return `${plain}<a href="#fn-${fnId}"><sup style="color: var(--accent);">[${fnId}]</sup></a>`;
    }
    return originalLinkRenderer.call(this, href, title, text);
  };

  marked.setOptions({
    renderer: renderer,
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (e) {}
      }
      try {
        return hljs.highlightAuto(code).value;
      } catch (e) {
        return code;
      }
    },
    // 单行换行渲染为 <br>（GFM 默认是折成空格）。
    // 公众号排版场景下作者习惯一行一句，且本项目 F3 蓝本 doocs/md（同样基于 marked）
    // 就是 breaks: true；折行会让「多行 `>` 引用」这类内容看起来丢了格式。
    breaks: true,
    gfm: true,
    headerIds: true,
    headerPrefix: '',
    mangle: false,
    silent: false,
  });

  // ===== Mermaid =====
  let mermaidCounter = 0;
  function initMermaid() {
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });
    }
  }
  initMermaid();

  // ===== Front Matter (文档元数据) =====
  // 只认文件首行的 `---` … `---` 块；允许前置 BOM 与 CRLF
  const FM_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
  // 块内至少要有一行 `key: value` 才算元数据，否则按正文处理（例如正文以 `---` 分割线开头）
  // 允许 `key:` 后为空（YAML 块状数组 / 嵌套映射的写法，如 `tags:` 换行再跟 `- 甲`）
  const FM_KV_RE = /^[ \t]*[^\s#][^:\n]*:[ \t]*(\S|$)/m;

  const FM_KEY = 'mdtu-frontmatter';
  const FM_MODES = ['panel', 'codeBlock', 'hide'];
  const FM_MODE_LABELS = { panel: '属性', codeBlock: '源码', hide: '隐藏' };

  // 与 style.css 中的 4 套主题平行维护。元数据面板一律输出内联样式，
  // 这样即使公众号编辑器剥掉了 <style>，卡片与标签的观感也不会塌掉。
  const FM_PALETTE = {
    github: { panelBg: '#f6f8fa', border: '#d8dee4', divider: 'rgba(208,215,222,.7)', head: '#8c959f', key: '#57606a', text: '#24292f', icon: '#8c959f', muted: '#8c959f', accent: '#0969da', yes: '#1a7f37', tagBg: '#ddf4ff', tagText: '#0969da', preBg: '#ffffff', preText: '#24292f', preBorder: '#d8dee4' },
    qingkong: { panelBg: '#eff4f8', border: '#dbe6ee', divider: 'rgba(180,200,215,.45)', head: '#93a6b3', key: '#5f7280', text: '#3f3f3f', icon: '#9ca3af', muted: '#9ca3af', accent: '#3d9fc7', yes: '#2f9e6a', tagBg: 'rgba(102,204,255,.16)', tagText: '#1f8fbf', preBg: '#2d2d2d', preText: '#f8f8f2', preBorder: 'transparent' },
  };

  // 键的类型图标（线条图标，跟随键文字取色）
  const FM_ICON_PATHS = {
    text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    number: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    checkbox: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    date: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
    datetime: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><path d="M7.5 7.5h.01"/>',
    folder: '<path d="M3 7.5a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.45.62L11.2 7.5H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  };

  let fmMode = (() => {
    try {
      const saved = localStorage.getItem(FM_KEY);
      // F4 首版把这一档叫「表格」，旧值按新档名迁移
      if (saved === 'table') return 'panel';
      return FM_MODES.includes(saved) ? saved : 'panel';
    } catch (e) {
      return 'panel';
    }
  })();

  // 最近一次渲染提取到的元数据，供字数统计 / 大纲 / 插入目录复用
  let fmCurrent = { raw: null, data: null, body: '' };

  // 元数据块占用的源码行数（没有元数据时为 0）
  function fmBlockLineCount() {
    return fmCurrent.raw ? fmCurrent.raw.split('\n').length + 2 : 0;
  }

  // 把源码切成「元数据块 + 正文」。必须在 marked.parse 之前调用，
  // 否则 marked 会把首个 `---` 当分割线、收尾 `---` 当 setext 下划线，把元数据吞成 <h2>。
  function splitFrontMatter(src) {
    const text = String(src == null ? '' : src);
    const none = { raw: null, data: null, body: text, broken: false };
    if (!window.jsyaml) return none; // js-yaml 未加载：退回原行为，不影响正文渲染

    const m = FM_RE.exec(text);
    if (!m || !FM_KV_RE.test(m[1])) return none;

    // 剥掉紧随闭合 `---` 的空行，让正文区间从真正的内容行开始
    // （不影响渲染，但字数 / 行数统计不会多出一个空行）
    const body = text.slice(m[0].length).replace(/^[\r\n]+/, '');
    let data = null;
    try {
      // 必须显式用 CORE_SCHEMA：默认 schema 会把 `date: 2026-09-20` 解析成 Date 对象，
      // 序列化后变成 2026-09-20T00:00:00.000Z，东八区会显示成前一天。
      data = window.jsyaml.load(m[1], { schema: window.jsyaml.CORE_SCHEMA });
    } catch (e) {
      data = null;
    }
    // 语法错误或不是键值对象：依然剥离（正文里不该出现 hr + 假标题），原文按「源码」形态回显
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { raw: m[1], data: null, body, broken: true };
    }
    return { raw: m[1], data, body, broken: false };
  }

  // 非 Date 的对象或数组（即 YAML 里的映射与序列）
  const fmIsAnyObj = (x) => x !== null && typeof x === 'object' && !(x instanceof Date);

  // 「容器」= 有内容、且需要在面板里展开成多行的对象 / 数组。
  // 标量数组（如 `tags: [a, b]`）不是容器——它仍在一行里渲染成标签胶囊。
  function fmIsContainer(v) {
    if (Array.isArray(v)) return v.length > 0 && v.some(fmIsAnyObj);
    return fmIsAnyObj(v) && Object.keys(v).length > 0;
  }

  // 容器内共有多少个叶子属性。标题行的「n 项」用它，展开后能逐行对上。
  function fmLeafCount(v) {
    if (fmIsContainer(v)) {
      if (Array.isArray(v)) return v.reduce((n, x) => n + fmLeafCount(x), 0);
      return Object.keys(v).reduce((n, k) => n + fmLeafCount(v[k]), 0);
    }
    return 1;
  }

  // 值 → 纯文本：布尔用 ✓/✗，数组顿号连接，对象折叠为 key: value
  function fmFormatValue(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? '✓' : '✗';
    if (v instanceof Date) {
      // CORE_SCHEMA 下日期是字符串，这里只是兜底
      return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }
    if (Array.isArray(v)) return v.map((x) => fmFormatValue(x)).filter((s) => s !== '').join('、');
    if (typeof v === 'object') return Object.keys(v).map((k) => `${k}: ${fmFormatValue(v[k])}`).join('、');
    return String(v);
  }

  // 推断键的类型，决定左侧图标（与 Obsidian 的 Properties 一致：图标表达类型）
  function fmTypeOf(key, v) {
    const k = String(key).toLowerCase();
    if (k === 'tags' || k === 'keywords' || k === 'categories') return 'tag';
    if (Array.isArray(v)) return 'list';
    if (typeof v === 'boolean') return 'checkbox';
    if (typeof v === 'number') return 'number';
    if (fmIsAnyObj(v)) return 'folder'; // 走到这里的只剩空对象，非空对象由容器行渲染
    const s = String(v == null ? '' : v).trim();
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return 'datetime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'date';
    return 'text';
  }

  function fmIcon(type, pal) {
    const d = FM_ICON_PATHS[type] || FM_ICON_PATHS.text;
    return `<svg class="fm-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;flex:0 0 auto;color:${pal.icon};">${d}</svg>`;
  }

  // 标签胶囊：Obsidian 用主题色半透明底 + 主题色文字
  function fmChip(text, pal) {
    return `<span class="fm-tag" style="display:inline-block;margin:1px 5px 1px 0;padding:1px 9px;border-radius:999px;background:${pal.tagBg};color:${pal.tagText};font-size:12px;line-height:1.7;white-space:nowrap;">${escapeHtml(text)}</span>`;
  }

  // 值 → HTML：数组渲染成标签胶囊，布尔带色；type 用于把单值 tags 也渲染成胶囊
  function fmRenderValue(v, pal, type) {
    if (Array.isArray(v)) {
      if (!v.length) return `<span style="color:${pal.muted};">—</span>`;
      return v.map((item) => fmChip(fmFormatValue(item), pal)).join('');
    }
    if (fmIsAnyObj(v)) return `<span style="color:${pal.muted};">—</span>`; // 空对象
    if (typeof v === 'boolean') {
      return `<span style="color:${v ? pal.yes : pal.muted};font-weight:600;">${v ? '✓' : '✗'}</span>`;
    }
    if (type === 'tag' && String(v == null ? '' : v).trim() !== '') return fmChip(String(v), pal);
    return escapeHtml(fmFormatValue(v)).replace(/\n/g, '<br>');
  }

  // 递归渲染「键 + 值」：容器（对象 / 含对象的数组）展开成「容器行 + 缩进子级」，
  // 叶子仍是一行。层级用左边框竖线表达，缩进与线条全部内联，复制到公众号不丢。
  function fmRenderNode(name, value, pal, withDivider) {
    const sep = withDivider ? `border-top:1px solid ${pal.divider};` : '';
    const rowStyle = `display:flex;align-items:flex-start;padding:5px 0;${sep}`;
    const keyStyle = `display:flex;align-items:center;flex:0 0 34%;min-width:88px;max-width:190px;padding-right:12px;font-size:13px;line-height:1.6;color:${pal.key};`;
    const cell = (icon, text) =>
      `<div class="fm-key" style="${keyStyle}">${icon}` +
      `<span class="fm-key-text" style="margin-left:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${text}</span></div>`;

    if (fmIsContainer(value)) {
      const isArr = Array.isArray(value);
      const kids = isArr ? value.map((v, i) => [`[${i}]`, v]) : Object.entries(value);
      const children = kids.map(([k, v], i) => fmRenderNode(k, v, pal, i > 0)).join('');
      return `<div class="fm-row fm-row-group" style="${rowStyle}">` +
        cell(fmIcon(isArr ? 'list' : 'folder', pal), escapeHtml(name)) +
        `<div class="fm-val fm-count" style="flex:1 1 auto;min-width:0;font-size:12px;line-height:1.75;color:${pal.muted};">${kids.length} 项</div>` +
        `</div>` +
        `<div class="fm-children" style="margin:0 0 2px 7px;padding-left:13px;border-left:1px solid ${pal.divider};">${children}</div>`;
    }

    const type = fmTypeOf(name, value);
    return `<div class="fm-row" style="${rowStyle}">` +
      cell(fmIcon(type, pal), escapeHtml(name)) +
      `<div class="fm-val" style="flex:1 1 auto;min-width:0;font-size:14px;line-height:1.6;color:${pal.text};word-break:break-word;">${fmRenderValue(value, pal, type)}</div>` +
      `</div>`;
  }

  // Obsidian 风格：正文之前一块「属性」面板 —— 圆角卡片 + 每行「类型图标 + 键 + 值」，
  // 数组值渲染成标签胶囊。嵌套对象 / 数组递归展开，因此每个叶子属性都独占一行。
  // 面板内不含 <h*>，所以不会被自动编号，也不会混进大纲。
  function buildFrontMatterBlock(fm) {
    if (!fm.raw || fmMode === 'hide') return '';

    const pal = FM_PALETTE[state.theme] || FM_PALETTE.github;
    const wrap = `margin:0 0 24px;padding:6px 12px 8px;border:1px solid ${pal.border};border-radius:8px;background:${pal.panelBg};`;

    // 源码形态：用户切到「源码」档，或 YAML 解析失败时的回退
    if (fmMode === 'codeBlock' || !fm.data) {
      const warn = fm.data
        ? ''
        : `<div class="fm-warn" style="margin:6px 0 8px;font-size:12px;color:${pal.muted};">元数据解析失败，已按原文展示</div>`;
      return (
        `<section class="fm-block" data-fm="code" style="${wrap}">` + warn +
        `<pre class="fm-pre" style="margin:0;padding:10px 12px;overflow:auto;border:1px solid ${pal.preBorder};border-radius:6px;background:${pal.preBg};color:${pal.preText};">` +
        `<code style="font-family:Consolas,Monaco,'Courier New',monospace;font-size:13px;line-height:1.55;white-space:pre;">${escapeHtml(fm.raw)}</code>` +
        `</pre></section>`
      );
    }

    const keys = Object.keys(fm.data);
    // 计数按叶子属性算：顶层可能只有 2 个键，展开后却有 8 行，数字要能逐行对上
    const leaves = keys.reduce((n, k) => n + fmLeafCount(fm.data[k]), 0);

    // 标题行是应用 UI（不是文章内容），复制到公众号时由 copyToClipboard() 摘掉
    const head =
      `<div class="fm-head" data-fm-ui="1" style="padding:2px 0 6px;border-bottom:1px solid ${pal.divider};font-size:12px;line-height:1.6;color:${pal.head};user-select:none;">` +
      `属性<span style="margin-left:6px;">${leaves} 项</span></div>`;

    const rows = keys.map((k, i) => fmRenderNode(k, fm.data[k], pal, i > 0)).join('');

    return `<section class="fm-block" data-fm="panel" style="${wrap}">${head}<div class="fm-body">${rows}</div></section>`;
  }

  // 元数据存在时才露出「元数据」档位控件，避免没有元数据的文档多一排无用 UI
  function updateFmModeControl(fm) {
    const group = $('#fmModeGroup');
    if (!group) return;
    group.style.display = fm.raw ? '' : 'none';
  }

  // ===== Render Function =====
  function renderMarkdown() {
    // 先剥掉文档首部的元数据，再交给 marked
    const fm = splitFrontMatter(editor.value);
    fmCurrent = fm;
    const md = fm.body;

    // Reset footnote state
    footnoteCounter = 0;
    footnoteList = [];

    // Parse markdown
    let html = marked.parse(md);

    // Sanitize
    html = DOMPurify.sanitize(html, {
      ADD_TAGS: ['sup', 'sub', 'span', 'div', 'figcaption', 'figure'],
      ADD_ATTR: ['class', 'style', 'data-id', 'id', 'href', 'src', 'alt', 'title', 'target', 'rel', 'colspan', 'rowspan', 'align', 'width', 'height'],
    });

    // 元数据块拼在正文之前（自己生成的标记，已转义，不经过 marked / DOMPurify）
    html = buildFrontMatterBlock(fm) + html;

    // Apply auto numbering
    if (state.autoNumber) {
      html = applyAutoNumbering(html);
    }

    preview.innerHTML = html;

    // Append footnote list (external links mode)
    if (state.footnoteLinks && footnoteList.length > 0) {
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const fnHtml = footnoteList.map((fn) =>
        `<p class="footnote-item" id="fn-${fn.id}">[${fn.id}]&nbsp;<a href="${esc(fn.href)}" target="_blank" rel="noopener">${esc(fn.href)}</a></p>`
      ).join('');
      preview.insertAdjacentHTML('beforeend',
        `<section class="footnote-section"><h4>参考文献</h4>${fnHtml}</section>`);
    }

    // Post-process: render mermaid blocks
    renderMermaidFromDOM();

    // Render math
    renderMath();

    // Update counts
    updateCounts();

    // Update the metadata mode control (only shown when there is metadata)
    updateFmModeControl(fm);

    // Update outline if visible
    updateOutline();
  }

  // ===== Mermaid Rendering (post-process from DOM) =====
  function renderMermaidFromDOM() {
    if (!window.mermaid) return;

    const mermaidBlocks = preview.querySelectorAll('code.language-mermaid');
    mermaidBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre || pre.tagName !== 'PRE') return;

      const code = codeEl.textContent.trim();
      const div = document.createElement('div');
      div.style.textAlign = 'center';
      div.className = 'mermaid-rendered';

      const mermaidId = `mermaid-svg-${mermaidCounter++}`;
      try {
        mermaid.render(mermaidId, code).then((result) => {
          div.innerHTML = result.svg;
          pre.replaceWith(div);
        }).catch((err) => {
          div.innerHTML = `<div style="color:#ef4444;padding:12px;font-size:13px;">Mermaid 渲染失败: ${err.message || err}</div>`;
          pre.replaceWith(div);
        });
      } catch (err) {
        div.innerHTML = `<div style="color:#ef4444;padding:12px;font-size:13px;">Mermaid 渲染失败: ${err.message || err}</div>`;
        pre.replaceWith(div);
      }
    });
  }

  // 块级公式的多行写法必须先在 DOM 上「合回一个文本节点」，否则 KaTeX 渲染不到。
  //
  // breaks: true 会把段落内的换行变成 <br>，于是
  //     $$
  //     \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
  //     $$
  // 被渲染成 `<p>$$<br>\int…<br>$$</p>`。KaTeX 的 auto-render 是按文本节点匹配
  // 定界符的，`$$` 被 <br> 拆到不同文本节点后就再也配不上，**整个块级公式不渲染**
  // （行内 `$x$` 不受影响，因为它在单个文本节点里）。
  // 这里把「整段就是一个块级公式」的段落里的 <br> 还原成换行，交给 KaTeX 正常处理。
  function unfoldDisplayMath() {
    const isWholeBlock = (s) => /^\$\$[\s\S]+\$\$$/.test(s) || /^\\\[[\s\S]+\\\]$/.test(s);
    preview.querySelectorAll('p').forEach((p) => {
      if (!isWholeBlock(p.textContent.trim())) return;
      p.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    });
  }

  // ===== Math Rendering =====
  function renderMath() {
    unfoldDisplayMath();
    if (!window.renderMathInElement) return;
    try {
      renderMathInElement(preview, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    } catch (e) {
      // KaTeX error - ignore
    }
  }

  // ===== Auto Numbering =====
  function applyAutoNumbering(html) {
    const counters = [0, 0, 0]; // h1, h2, h3
    let result = html.replace(/<(h[1-3])([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
      const level = parseInt(tag[1]);
      counters[level - 1]++;
      for (let i = level; i < 3; i++) counters[i] = 0;
      const prefix = counters.slice(0, level).join('.') + ' ';
      return `<${tag}${attrs}>${prefix}${content}</${tag}>`;
    });
    return result;
  }

  // ===== TOC Generation =====
  function generateTOC() {
    const md = editor.value;
    // 元数据必须留在文件最顶部：目录只在正文区间内查找与插入
    const fm = splitFrontMatter(md);
    const head = fm.raw ? md.slice(0, md.length - fm.body.length) : '';
    let body = fm.body;
    const lines = body.split('\n');
    const tocLines = ['<!-- TOC -->', ''];
    let inCodeBlock = false;

    for (const line of lines) {
      if (/^```/.test(line.trim())) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      const match = line.match(/^(#{1,4})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/[#*`~]/g, '').trim();
        const indent = '  '.repeat(level - 1);
        tocLines.push(`${indent}- [${text}](#${text.toLowerCase().replace(/\s+/g, '-')})`);
      }
    }

    tocLines.push('', '<!-- /TOC -->');

    // Check if TOC already exists
    const tocRegex = /<!-- TOC -->[\s\S]*?<!-- \/TOC -->/;
    if (tocRegex.test(body)) {
      body = body.replace(tocRegex, tocLines.join('\n'));
    } else {
      // Insert at the top of the body (right after the metadata block)
      body = tocLines.join('\n') + '\n\n' + body;
    }
    editor.value = head + body;
    renderMarkdown();
    showToast('目录已插入');
  }

  // ===== Update Counts =====
  function updateCounts() {
    // 元数据块不计入统计，否则数字会和剪贴板里的正文对不上
    const text = fmCurrent.raw ? fmCurrent.body : editor.value;
    charCount.textContent = `${text.length} 字符`;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    wordCount.textContent = `${words} 词`;
    lineCount.textContent = `${text.split('\n').length} 行`;

    const metaCount = $('#metaCount');
    if (metaCount) {
      metaCount.style.display = fmCurrent.raw ? '' : 'none';
      if (fmCurrent.raw) {
        // 与面板标题行口径一致：按叶子属性数，而不是顶层键数
        metaCount.textContent = fmCurrent.data
          ? `元数据 ${Object.keys(fmCurrent.data).reduce((n, k) => n + fmLeafCount(fmCurrent.data[k]), 0)} 项（未计入）`
          : '元数据未计入';
      }
    }
  }

  // ===== Editor Toolbar Actions =====
  function wrapSelection(before, after = '', placeholder = '') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const selected = text.substring(start, end) || placeholder;

    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    editor.value = newText;

    const newCursorStart = start + before.length;
    const newCursorEnd = newCursorStart + selected.length;
    editor.setSelectionRange(newCursorStart, newCursorEnd);
    editor.focus();
    renderMarkdown();
  }

  function prefixLines(prefix) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', end);
    const actualEnd = lineEnd === -1 ? text.length : lineEnd;

    const lines = text.substring(lineStart, actualEnd).split('\n');
    const newLines = lines.map((line, i) => {
      if (typeof prefix === 'function') return prefix(line, i);
      return prefix + line;
    });

    const newText = text.substring(0, lineStart) + newLines.join('\n') + text.substring(actualEnd);
    editor.value = newText;
    editor.setSelectionRange(lineStart, lineStart + newLines.join('\n').length);
    editor.focus();
    renderMarkdown();
  }

  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const text_content = editor.value;
    editor.value = text_content.substring(0, start) + text + text_content.substring(editor.selectionEnd);
    editor.setSelectionRange(start + text.length, start + text.length);
    editor.focus();
    renderMarkdown();
  }

  function handleToolbar(action) {
    switch (action) {
      case 'bold':
        wrapSelection('**', '**', '粗体文本');
        break;
      case 'italic':
        wrapSelection('*', '*', '斜体文本');
        break;
      case 'strikethrough':
        wrapSelection('~~', '~~', '删除线文本');
        break;
      case 'h1':
        prefixLines('# ');
        break;
      case 'h2':
        prefixLines('## ');
        break;
      case 'h3':
        prefixLines('### ');
        break;
      case 'link':
        wrapSelection('[', '](https://)', '链接描述');
        break;
      case 'image':
        wrapSelection('![', '](https://)', '图片描述');
        break;
      case 'code':
        wrapSelection('`', '`', 'code');
        break;
      case 'codeblock':
        wrapSelection('```js\n', '\n```', '// code');
        break;
      case 'ul':
        prefixLines('- ');
        break;
      case 'ol':
        prefixLines((line, i) => `${i + 1}. `);
        break;
      case 'task':
        prefixLines('- [ ] ');
        break;
      case 'quote':
        prefixLines('> ');
        break;
      case 'hr':
        insertAtCursor('\n---\n\n');
        break;
      case 'table':
        insertAtCursor('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |\n\n');
        break;
      case 'formula':
        wrapSelection('$', '$', 'E=mc^2');
        break;
      case 'mermaid':
        insertAtCursor('\n```mermaid\ngraph TD\n    A[开始] --> B{条件判断}\n    B -->|是| C[执行操作]\n    B -->|否| D[跳过]\n    C --> E[结束]\n    D --> E\n```\n');
        break;
    }
  }

  // ===== Theme Switching =====
  // 预览容器的 class 由「主题 + 方格背景 + 设备档」共同决定。
  // 统一从这里拼装：任何一处直接写 `preview.className = ...` 都会把其余几维冲掉。
  function syncPreviewClass() {
    preview.className = [
      'markdown-body',
      'theme-' + state.theme,
      state.gridBg ? 'grid-bg' : '',
      'device-' + state.device,
    ].filter(Boolean).join(' ');
  }

  function applyTheme(theme) {
    state.theme = normalizeTheme(theme);
    localStorage.setItem('mdtu-theme', state.theme);
    syncPreviewClass();
    themeSelect.value = state.theme;
    // 元数据块用的是内联样式（按主题取色），换主题后必须重渲染才能跟着变色
    renderMarkdown();
  }

  // ===== Preview Mode: 设备端 =====
  // 只影响「预览怎么看」，不参与复制 / 导出产物 ——
  // 模拟出来的版心与字号是观察工具，写进产物会把真实排版带偏。
  // 只有设备一个维度：每档隐含「这个尺寸下最典型的阅读场景」，平台规则直接内建在档位里
  // （见 style.css 的 `.device-*` 段）：
  //   pc   → 浏览器实际宽度，Web 排版（主题原貌）
  //   ipad → 视口 768px，Web 排版 + 平板适配
  //   app  → 视口 375px，公众号排版
  // 档位在工具栏上全部平铺，点一下就切（不用 <select>）。
  const DEVICE_IDS = ['pc', 'ipad', 'app'];

  function pickSaved(key, ids, fallback) {
    try {
      const v = localStorage.getItem(key);
      return ids.includes(v) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // 把按钮组的选中态对齐到当前值（.active + aria-pressed，供读屏与样式共用）
  function syncSegBtns(btns, active, dataKey) {
    btns.forEach((b) => {
      const on = b.dataset[dataKey] === active;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // 切换是「即时可见」的操作：档位激活态一换，预览就跟着变，不需要再弹 Toast
  // 解释一遍 —— 提示浮层会挡住正文，停留 2.5s 反而打断观察。
  function applyDevice(device) {
    state.device = DEVICE_IDS.includes(device) ? device : 'pc';
    localStorage.setItem('mdtu-device', state.device);
    syncPreviewClass();
    // PC 是「不套壳」的基准态；另两档把版心外的底衬压深，设备边界才看得出来
    previewScroll.classList.toggle('device-frame', state.device !== 'pc');
    syncSegBtns(deviceBtns, state.device, 'device');
  }

  // ===== Copy to Clipboard (Rich Text) =====

  // 剥掉「只对编辑界面有意义」的属性：这份文件一旦托管成资料库页面，页面编辑器会给每个
  // 节点打上 data-page-node-id（pnid），用于节点级评论与「划词让 AI 改」的定位。
  // 那是编辑器的事，不能跟着正文进公众号，也不该出现在导出的 HTML / Word 里。
  // 源码里这类属性已全部清空（2026-10-13，312 处），本段留作防御 —— 文件若再被托管回去，
  // 属性会重新出现，不拦就会跟着克隆漏进产物。
  function stripEditorOnlyAttrs(root) {
    if (!root) return root;
    if (root.removeAttribute) root.removeAttribute('data-page-node-id');
    if (root.querySelectorAll) {
      root.querySelectorAll('[data-page-node-id]')
        .forEach((el) => el.removeAttribute('data-page-node-id'));
    }
    return root;
  }

  // 预览模式类（device-*）是**观察工具**，不属于文章内容：
  // 复制与导出前一律摘掉，否则模拟出来的版心 / 字号会被当成真实排版带进产物。
  function stripPreviewModeClasses(root) {
    if (!root || !root.classList) return root;
    const drop = [];
    root.classList.forEach((c) => {
      if (/^device-/.test(c)) drop.push(c);
    });
    drop.forEach((c) => root.classList.remove(c));
    return root;
  }

  function copyToClipboard() {
    // Clone the preview for copying
    const clone = stripPreviewModeClasses(stripEditorOnlyAttrs(preview.cloneNode(true)));
    // 元数据面板的「属性 n 项」标题行是应用 UI，不属于文章内容，复制时摘掉
    clone.querySelectorAll('[data-fm-ui]').forEach((el) => el.remove());
    // The CSS background (SVG data URI) is usually stripped by the WeChat editor,
    // so for the copy we always rebuild the watermark as real DOM nodes below.
    clone.style.backgroundImage = '';
    clone.style.backgroundRepeat = '';
    const wrapper = document.createElement('div');
    wrapper.appendChild(clone);

    // Get computed styles from the theme
    const themeStyles = getThemeStyles(state.theme);
    const styleEl = document.createElement('style');
    styleEl.textContent = themeStyles;
    wrapper.insertBefore(styleEl, wrapper.firstChild);

    // Try to copy as rich text
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.background = '#fff';
    tempDiv.style.width = (preview.clientWidth || 780) + 'px';
    tempDiv.innerHTML = wrapper.innerHTML;
    document.body.appendChild(tempDiv);

    // Watermark for the copied rich text (DOM nodes survive WeChat sanitizing better)
    if (isWatermarkActive(watermark) && watermark.onCopy) {
      injectWatermarkNodes(tempDiv, watermark);
    }

    // Select and copy
    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast('已复制到剪贴板，可直接粘贴到公众号', 'success');
      } else {
        // Fallback: copy plain HTML
        fallbackCopy(preview.innerHTML);
      }
    } catch (err) {
      fallbackCopy(preview.innerHTML);
    }

    sel.removeAllRanges();
    document.body.removeChild(tempDiv);
  }

  function fallbackCopy(text) {
    if (copyTextFallback(text)) showToast('已复制 HTML 到剪贴板', 'success');
    else showToast('复制失败', 'error');
  }

  function getThemeStyles(theme) {
    const styles = {
      github: `body, div { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.6; color: #24292f; }
        h1 { font-size: 2em; font-weight: 600; padding-bottom: .3em; border-bottom: 1px solid #d0d7de; margin: 0 0 16px; }
        h2 { font-size: 1.5em; font-weight: 600; padding-bottom: .3em; border-bottom: 1px solid #d0d7de; margin: 24px 0 16px; }
        h3 { font-size: 1.25em; font-weight: 600; margin: 24px 0 16px; }
        p { margin: 0 0 16px; }
        a { color: #0969da; }
        code { font-size: 85%; padding: .2em .4em; background: rgba(175,184,193,.2); border-radius: 6px; font-family: Consolas, monospace; }
        pre { padding: 16px; overflow: auto; border-radius: 6px; background: #f6f8fa; }
        pre code { padding: 0; background: none; }
        blockquote { padding: 0 16px; border-left: .25em solid #d0d7de; margin: 0 0 16px; }
        blockquote p, blockquote li { color: #57606a; }
        blockquote > :first-child { margin-top: 0; }
        blockquote > :last-child { margin-bottom: 0; }
        table { border-collapse: collapse; }
        table th, table td { padding: 6px 13px; border: 1px solid #d0d7de; }
        table th { background: #f6f8fa; font-weight: 600; }
        table tr:nth-child(2n) { background: #f6f8fa; }`,
      qingkong: `body, div { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.8; color: #3f3f3f; }
        h1 { font-size: 1.8em; font-weight: bold; text-align: center; color: #66CCFF; border-bottom: 2px solid #66CCFF; padding-bottom: 10px; }
        h2 { font-size: 1.4em; font-weight: bold; color: #66CCFF; border-left: 5px solid #66CCFF; padding-left: 12px; margin: 30px 0 16px; }
        h3 { font-size: 1.2em; font-weight: bold; color: #555; }
        p { margin: 0 0 16px; }
        a { color: #66CCFF; text-decoration: none; border-bottom: 1px solid #66CCFF; }
        code { font-size: 90%; padding: 2px 6px; background: rgba(102,204,255,.12); color: #e83e8c; border-radius: 3px; font-family: Consolas, monospace; }
        pre { padding: 16px; border-radius: 4px; background: #2d2d2d; }
        pre code { padding: 0; background: none; color: #f8f8f2; }
        blockquote { padding: 10px 16px; background: rgba(102,204,255,.08); border-left: 4px solid #66CCFF; }
        blockquote p, blockquote li { color: #666; }
        blockquote > :first-child { margin-top: 0; }
        blockquote > :last-child { margin-bottom: 0; }
        table { border-collapse: collapse; }
        table th, table td { padding: 8px 12px; border: 1px solid #e0e0e0; }
        table th { background: rgba(102,204,255,.1); }`,
    };
    return styles[theme] || styles.github;
  }

  // ===== Export (F1) =====
  // 四个出口：复制 Markdown 源码 / 导出 HTML / 导出 PDF / 导出 Word。
  // 全部走浏览器本地下载（Blob + ObjectURL + <a download>），不经过任何服务端。

  // 独立 HTML 文档的外壳样式。
  // ⚠️ 这一段必须排在「主题样式」**之前**：主题样式会在 `body, div` 上声明
  // 背景 / 文字色，外壳样式（`body { margin: 0; padding: 24px 16px }` 等）若排在后面，
  // 会把主题的背景顶掉（深色文档变白底浅字）。
  const EXPORT_PAGE_CSS = `*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; padding: 24px 16px; }
.markdown-body { width: 100%; max-width: 820px; margin: 0 auto; padding: 40px; border-radius: 8px; box-shadow: 0 0 1px rgba(0,0,0,.08); }
.markdown-body img { max-width: 100%; }
@page { margin: 16mm; }
@media print {
  body { margin: 0; padding: 0; }
  .markdown-body { max-width: none; padding: 0; border-radius: 0; box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  pre, blockquote, table, .mermaid-rendered, .katex-display, .fm-block { break-inside: avoid; }
  h1, h2, h3, h4, h5, h6 { break-after: avoid; }
}`;

  // Word 的 HTML 引擎只认一小撮 CSS，且不认 em 单位。
  // 主题样式跑在前面，这里用 pt 把标题字号、表格边框、代码块兜底回来。
  const WORD_COMPAT_CSS = `html, body { font-size: 12pt; }
h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 14pt; } h4, h5, h6 { font-size: 12pt; }
p { margin: 0 0 8pt; }
table { border-collapse: collapse; width: 100%; }
table th, table td { border: 1px solid #999999; padding: 4pt 6pt; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: Consolas, "Courier New", monospace; font-size: 10pt; padding: 8pt; }
code { font-family: Consolas, "Courier New", monospace; }
blockquote { margin: 0 0 8pt; padding: 4pt 10pt; }
ul, ol { margin: 0 0 8pt; padding-left: 22pt; }
img { max-width: 100%; }`;

  // 文档标题：正文里第一个 H1 → 元数据的 title → 空
  function docTitleText() {
    const body = fmCurrent && fmCurrent.body ? fmCurrent.body : editor.value;
    const m = /^\s{0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(body || '');
    let title = m ? m[1].trim() : '';
    if (!title && fmCurrent && fmCurrent.data && fmCurrent.data.title != null) {
      title = String(fmCurrent.data.title).trim();
    }
    return title;
  }

  // 文件名清洗：剥 Markdown 标记与各系统的非法字符，截断到 80 字符
  function sanitizeFileName(name) {
    const out = String(name == null ? '' : name)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [文字](链接) → 文字
      .replace(/[*_`~]/g, '')                  // 强调 / 行内代码标记
      .replace(/[\\/:*?"<>|]/g, '')            // Windows 非法字符
      .replace(/[\u0000-\u001f]/g, '')         // 控制字符
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+|[.\s]+$/g, '')         // 首尾的点与空白
      .slice(0, 80)
      .trim();
    return out || 'document';
  }

  function getDocBaseName() {
    return sanitizeFileName(docTitleText() || 'document');
  }

  // 克隆预览内容，并剥掉只对编辑界面有意义的东西：
  // 页宽 max-width / 预览用的水印背景（导出时另挂）/ id / 方格背景
  function clonePreviewForExport() {
    const clone = stripPreviewModeClasses(stripEditorOnlyAttrs(preview.cloneNode(true)));
    clone.removeAttribute('id');
    clone.removeAttribute('style');
    clone.classList.remove('grid-bg');
    return clone;
  }

  // 取 CDN 样式表的文本。
  // 顺序：① 同源样式表直接读 CSSOM（不需要网络）→ ② 网络抓取（CDN 带 CORS 头）
  // 两者都失败时返回 null，调用方会退化成保留 <link> 标签。
  const exportCssCache = new Map();
  async function readCssText(href) {
    if (exportCssCache.has(href)) return exportCssCache.get(href);
    let text = null;

    // ① CSSOM：跨域样式表读 cssRules 会抛 SecurityError，落到 ②
    try {
      const sheet = Array.from(document.styleSheets).find((s) => s.href === href);
      if (sheet && sheet.cssRules) {
        text = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      }
    } catch (e) { /* 跨域 → 走网络 */ }

    // ② 网络
    if (!text) {
      try {
        const res = await fetch(href, { mode: 'cors' });
        if (res.ok) text = await res.text();
      } catch (e) { /* 离线 / 被拦 → 保持 null */ }
    }

    exportCssCache.set(href, text);
    return text;
  }

  // 把 CSS 里的相对 url() 变绝对。
  // 关键在 KaTeX：它的 @font-face 写的是 `url(fonts/KaTeX_*.woff2)`，
  // 内联进导出文件后相对路径会指向导出文件所在目录，字体全部 404。
  function absolutizeCssUrls(css, baseHref) {
    return String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, quote, url) => {
      if (/^(data:|https?:|\/\/|#)/i.test(url)) return whole;
      let abs;
      try { abs = new URL(url, baseHref).href; } catch (e) { return whole; }
      return 'url("' + abs + '")';
    });
  }

  async function collectExportCss() {
    const links = Array.from(document.querySelectorAll('link[data-export-css]'));
    const inlined = [];
    const fallback = [];
    for (const link of links) {
      const href = link.href;
      const raw = await readCssText(href);
      if (raw) inlined.push(absolutizeCssUrls(raw, href));
      else fallback.push(href);
    }
    return { inlined, fallback };
  }

  // 预览里的水印是挂在元素 background-image 上的 data URI，
  // 导出时改挂到文档容器，保持「所见即所得」且文件自包含。
  function exportWatermarkCss() {
    if (!isWatermarkActive(watermark)) return '';
    return '.markdown-body { background-image: ' + buildWatermarkUrl(watermark) + '; background-repeat: repeat; }';
  }

  // 元数据原文以注释形式留在导出文件里，方便二次编辑（F4 规划里预留的这条）
  function exportFrontMatterComment() {
    if (!fmCurrent.raw) return '';
    return '<!--\n' + String(fmCurrent.raw).replace(/-->/g, '-- >') + '\n-->\n';
  }

  async function buildStandaloneHtml() {
    const { inlined, fallback } = await collectExportCss();
    const title = docTitleText() || 'Markdown 文档';
    const linkTags = fallback.map((h) => '<link rel="stylesheet" href="' + escapeHtml(h) + '">').join('\n');

    return '<!DOCTYPE html>\n' +
      '<html lang="zh-CN">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + escapeHtml(title) + '</title>\n' +
      exportFrontMatterComment() +
      '<style>\n' + EXPORT_PAGE_CSS + '\n</style>\n' +
      '<style>\n' + getThemeStyles(state.theme) + '\n</style>\n' +
      (inlined.length ? '<style>\n' + inlined.join('\n') + '\n</style>\n' : '') +
      (linkTags ? linkTags + '\n' : '') +
      '<style>\n' + exportWatermarkCss() + '\n</style>\n' +
      '</head>\n<body>\n' +
      clonePreviewForExport().outerHTML + '\n' +
      '</body>\n</html>\n';
  }

  // Word 导出的固有限制：Word 不认 flex。元数据面板整块是 flex 行，
  // 直接导会让「键 / 值」竖着堆成两行。这里把它降级成两列表格。
  function fmPanelToTable(root) {
    root.querySelectorAll('.fm-block[data-fm="panel"]').forEach((block) => {
      const body = block.querySelector('.fm-body');
      if (!body) return;
      const rows = [];
      const walk = (el, depth) => {
        Array.from(el.children).forEach((child) => {
          if (child.classList.contains('fm-row')) {
            const keyEl = child.querySelector('.fm-key-text');
            const valEl = child.querySelector('.fm-val');
            let value = '';
            if (valEl) {
              const chips = valEl.querySelectorAll('.fm-tag');
              value = chips.length
                ? Array.from(chips).map((c) => c.textContent).join('、')
                : valEl.textContent;
            }
            rows.push(
              '<tr>' +
              '<td style="border:1px solid #999999;padding:4pt 6pt;width:30%;' + (depth ? 'padding-left:' + (6 + depth * 12) + 'pt;' : '') + '">' +
              escapeHtml((keyEl ? keyEl.textContent : '').trim()) + '</td>' +
              '<td style="border:1px solid #999999;padding:4pt 6pt;">' +
              escapeHtml(value.trim()) + '</td>' +
              '</tr>'
            );
          } else if (child.classList.contains('fm-children')) {
            walk(child, depth + 1);
          }
        });
      };
      walk(body, 0);
      const table = document.createElement('table');
      table.setAttribute('style', 'width:100%;border-collapse:collapse;margin:0 0 12pt;');
      table.innerHTML = rows.join('');
      block.replaceWith(table);
    });
  }

  function buildWordHtml() {
    const clone = clonePreviewForExport();
    fmPanelToTable(clone);
    const title = docTitleText() || 'Markdown 文档';

    // 以 application/msword 输出 .doc。MSO 头让 Word / WPS 走「打印视图」，
    // 配合 @page WordSection1 控制纸张与页边距。
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<title>' + escapeHtml(title) + '</title>\n' +
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>' +
      '<w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->\n' +
      '<style>\n@page WordSection1 { size: A4; margin: 2cm; }\ndiv.WordSection1 { page: WordSection1; }\n' +
      getThemeStyles(state.theme) + '\n' + WORD_COMPAT_CSS + '\n</style>\n' +
      '</head>\n<body>\n<div class="WordSection1">\n' +
      clone.outerHTML + '\n</div>\n</body>\n</html>\n';
  }

  // 统一的本地下载出口
  function downloadBlob(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 立刻 revoke 会让部分浏览器的下载中断，留一点缓冲
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 5000);
  }

  // 复制 Markdown 源码。Clipboard API 需要安全上下文 + 用户手势，
  // file:// 下虽然也是安全上下文，但仍可能因权限策略失败 → 保留 execCommand 降级。
  function copyTextFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    let ok = false;
    try {
      ta.select();
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  async function exportCopyMarkdown() {
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(editor.value);
        ok = true;
      }
    } catch (e) {
      ok = false;
    }
    if (!ok) ok = copyTextFallback(editor.value);
    showToast(ok ? '已复制 Markdown 源码' : '复制失败，请手动选择复制', ok ? 'success' : 'error');
    return ok;
  }

  function exportPdf() {
    showToast('在打印对话框里选择「目标 → 另存为 PDF」');
    // 等一帧，确保刚触发的重渲染（如 Mermaid 异步出图）已经落到 DOM 上
    setTimeout(() => window.print(), 60);
  }

  async function runExport(kind) {
    if (kind === 'md') return exportCopyMarkdown();
    if (kind === 'pdf') return exportPdf();
    try {
      if (kind === 'html') {
        const html = await buildStandaloneHtml();
        downloadBlob(html, getDocBaseName() + '.html', 'text/html;charset=utf-8');
        showToast('已导出 HTML', 'success');
      } else if (kind === 'word') {
        downloadBlob(buildWordHtml(), getDocBaseName() + '.doc', 'application/msword');
        showToast('已导出 Word（.doc，HTML 套壳）', 'success');
      }
    } catch (err) {
      showToast('导出失败：' + ((err && err.message) || err), 'error');
    }
  }

  // ===== Toast =====
  let toastTimer = null;
  function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast show';
    if (type) toast.classList.add(type);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, 2500);
  }

  // ===== Template Management =====
  function getTemplates() {
    try {
      return JSON.parse(localStorage.getItem('mdtu-templates') || '[]');
    } catch {
      return [];
    }
  }

  function saveTemplates(templates) {
    localStorage.setItem('mdtu-templates', JSON.stringify(templates));
  }

  function renderTemplateList() {
    const templates = getTemplates();
    const list = $('#templateList');
    list.innerHTML = '';
    if (templates.length === 0) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">暂无模板，点击「新建模板」创建</div>';
      return;
    }
    templates.forEach((tpl, i) => {
      const item = document.createElement('div');
      item.className = 'template-item' + (state.currentTemplate === i ? ' active' : '');
      item.textContent = tpl.name;
      item.onclick = () => {
        state.currentTemplate = i;
        $('#templateName').value = tpl.name;
        $('#templateContent').value = tpl.content;
        renderTemplateList();
      };
      list.appendChild(item);
    });
  }

  // ===== Event Listeners =====

  // Editor input
  editor.addEventListener('input', () => {
    renderMarkdown();
    saveContent();
  });

  // Guard: while the outline (or any programmatic jump) is scrolling one pane,
  // the two-way sync must stay quiet, otherwise the panes fight each other.
  let suppressSyncUntil = 0;
  function suppressSync(ms = 500) {
    suppressSyncUntil = Math.max(suppressSyncUntil, performance.now() + ms);
  }
  const syncBlocked = () => performance.now() < suppressSyncUntil;

  // Editor scroll sync
  editor.addEventListener('scroll', () => {
    if (!state.syncScroll || syncBlocked()) return;
    const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    previewWrap.scrollTop = ratio * (previewWrap.scrollHeight - previewWrap.clientHeight || 1);
  });

  // Preview scroll sync
  previewWrap.addEventListener('scroll', () => {
    if (!state.syncScroll || syncBlocked()) return;
    const ratio = previewWrap.scrollTop / (previewWrap.scrollHeight - previewWrap.clientHeight || 1);
    editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight || 1);
  });

  // Toolbar buttons
  document.querySelectorAll('.tool-btn[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleToolbar(btn.dataset.action));
  });

  // Theme select
  themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));

  // Metadata (Front Matter) display mode — table / codeBlock / hide
  const fmModeSelect = $('#fmModeSelect');
  fmModeSelect.value = fmMode;
  fmModeSelect.addEventListener('change', (e) => {
    fmMode = FM_MODES.includes(e.target.value) ? e.target.value : 'table';
    try { localStorage.setItem(FM_KEY, fmMode); } catch (err) {}
    renderMarkdown();
    showToast('元数据展示方式：' + FM_MODE_LABELS[fmMode]);
  });

  // Auto numbering
  $('#btnAutoNumber').addEventListener('click', () => {
    state.autoNumber = !state.autoNumber;
    $('#btnAutoNumber').classList.toggle('active', state.autoNumber);
    renderMarkdown();
    showToast(state.autoNumber ? '自动编号已开启' : '自动编号已关闭');
  });

  // Insert TOC
  $('#btnInsertTOC').addEventListener('click', generateTOC);

  // Grid background
  $('#btnGridBg').addEventListener('click', () => {
    state.gridBg = !state.gridBg;
    $('#btnGridBg').classList.toggle('active', state.gridBg);
    syncPreviewClass();
    showToast(state.gridBg ? '方格背景已开启' : '方格背景已关闭');
  });

  // Link to footnote
  $('#btnLinkFootnote').addEventListener('click', () => {
    state.footnoteLinks = !state.footnoteLinks;
    $('#btnLinkFootnote').classList.toggle('active', state.footnoteLinks);
    renderMarkdown();
    showToast(state.footnoteLinks ? '外链转脚注已开启' : '外链转脚注已关闭');
  });

  // Copy
  $('#btnCopy').addEventListener('click', copyToClipboard);

  // ===== Export dropdown (F1) =====
  const exportWrap = $('#exportWrap');
  const exportMenu = $('#exportMenu');
  const btnExport = $('#btnExport');

  function setExportMenu(open) {
    exportMenu.classList.toggle('show', open);
    exportWrap.classList.toggle('open', open);
    btnExport.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  btnExport.addEventListener('click', (e) => {
    e.stopPropagation(); // 否则会立刻被下面的「点外部关闭」收掉
    setExportMenu(!exportMenu.classList.contains('show'));
  });

  exportMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-export]');
    if (!item) return;
    setExportMenu(false);
    runExport(item.dataset.export);
  });

  document.addEventListener('click', (e) => {
    if (!exportWrap.contains(e.target)) setExportMenu(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setExportMenu(false);
  });

  // Open local file
  $('#btnOpenFile').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (editor.value && !confirm('打开文件会替换当前内容，是否继续？')) {
        e.target.value = '';
        return;
      }
      editor.value = reader.result;
      renderMarkdown();
      saveContent();
      editor.scrollTop = 0;
      showToast(`已打开：${file.name}`);
    };
    reader.onerror = () => showToast('文件读取失败');
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  });

  // Clear
  $('#btnClear').addEventListener('click', () => {
    if (confirm('确定清空所有内容？')) {
      editor.value = '';
      renderMarkdown();
      saveContent();
      showToast('内容已清空');
    }
  });

  // URL Fetch
  $('#btnUrlFetch').addEventListener('click', () => {
    $('#urlModal').classList.add('show');
    $('#urlInput').focus();
  });

  $('#urlModalClose').addEventListener('click', () => $('#urlModal').classList.remove('show'));
  $('#urlCancel').addEventListener('click', () => $('#urlModal').classList.remove('show'));

  $('#urlConfirm').addEventListener('click', async () => {
    const url = $('#urlInput').value.trim();
    if (!url) return;
    showToast('正在采集内容...');
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const html = await response.text();
      // Simple HTML to Markdown conversion
      const md = htmlToMarkdown(html);
      editor.value = md;
      renderMarkdown();
      saveContent();
      showToast('采集成功', 'success');
    } catch (err) {
      showToast('采集失败：' + err.message, 'error');
    }
    $('#urlModal').classList.remove('show');
    $('#urlInput').value = '';
  });

  $('#urlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#urlConfirm').click();
  });

  // Sync scroll toggle
  $('#btnPreviewScroll').addEventListener('click', () => {
    state.syncScroll = !state.syncScroll;
    $('#btnPreviewScroll').classList.toggle('active', state.syncScroll);
    showToast(state.syncScroll ? '同步滚动已开启' : '同步滚动已关闭');
  });

  // ===== Fullscreen page width =====
  const FS_WIDTH_KEY = 'mdtu-fs-width';
  const DEFAULT_FS_WIDTH = 880;
  let fsWidth = parseInt(localStorage.getItem(FS_WIDTH_KEY), 10);
  if (isNaN(fsWidth) || fsWidth < 0) fsWidth = DEFAULT_FS_WIDTH;

  function applyFsWidth(w) {
    fsWidth = w;
    if (!w) {
      preview.style.maxWidth = 'none';
      preview.classList.remove('page-mode');
    } else {
      preview.style.maxWidth = w + 'px';
      preview.classList.add('page-mode');
    }
    document.querySelectorAll('.width-btn').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.width, 10) === w);
    });
    try { localStorage.setItem(FS_WIDTH_KEY, String(w)); } catch (e) {}
  }

  document.querySelectorAll('.width-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyFsWidth(parseInt(btn.dataset.width, 10)));
  });

  // Fullscreen
  function enterFullscreen() {
    const panel = $('#previewPanel');
    panel.classList.add('fullscreen');
    $('#btnFullscreen').style.display = 'none';
    $('#btnPreviewScroll').style.display = 'none';
    $('#btnExitFs').style.display = '';
    $('#fsWidthGroup').style.display = '';
    applyFsWidth(fsWidth);
  }
  function exitFullscreen() {
    const panel = $('#previewPanel');
    panel.classList.remove('fullscreen');
    $('#btnFullscreen').style.display = '';
    $('#btnPreviewScroll').style.display = '';
    $('#btnExitFs').style.display = 'none';
    $('#fsWidthGroup').style.display = 'none';
    preview.style.maxWidth = '';
    preview.classList.remove('page-mode');
  }
  $('#btnFullscreen').addEventListener('click', enterFullscreen);
  $('#btnExitFs').addEventListener('click', exitFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#previewPanel').classList.contains('fullscreen')) exitFullscreen();
  });

  // Preview mode: 设备档
  // 档位平铺成按钮组：用事件委托接整个组，点哪个切哪个
  $('#deviceGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (btn) applyDevice(btn.dataset.device);
  });

  // ===== Document Outline =====
  const outlinePanel = $('#outlinePanel');
  const outlineBody = $('#outlineBody');
  let outlineVisible = false;

  // Normalize heading text for matching preview <-> source
  const normHeading = (s) =>
    String(s)
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[`*_~]/g, '')
      .replace(/^[\d.\s]+/, '')
      .trim()
      .toLowerCase();

  // Collect ATX headings (and their line numbers) from the markdown source,
  // skipping anything inside fenced code blocks.
  function getSourceHeadings() {
    const lines = editor.value.split('\n');
    const fmLines = fmBlockLineCount();
    const out = [];
    let inFence = false;
    lines.forEach((line, idx) => {
      if (idx < fmLines) return; // 元数据块不参与大纲
      const trimmed = line.trim();
      if (/^(```|~~~)/.test(trimmed)) { inFence = !inFence; return; }
      if (inFence) return;
      const m = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (m) out.push({ level: m[1].length, text: m[2].trim(), line: idx });
    });
    return out;
  }

  // Vertical offset of an element inside the preview scroll container
  function offsetInPreview(el) {
    const cRect = previewWrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return previewWrap.scrollTop + (r.top - cRect.top);
  }

  // Smooth scroll helper (works on textarea / div alike)
  function animateScroll(el, to, duration = 260) {
    const from = el.scrollTop;
    const delta = to - from;
    if (Math.abs(delta) < 2) { el.scrollTop = to; return; }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
      el.scrollTop = from + delta * eased;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Scroll the editor (left pane) so that the given source line lands at the top
  function scrollEditorToLine(lineIdx) {
    const lines = editor.value.split('\n');
    const cs = getComputedStyle(editor);
    const div = document.createElement('div');
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'wordSpacing',
      'paddingLeft', 'paddingRight', 'paddingTop', 'borderLeftWidth', 'borderRightWidth',
      'boxSizing', 'tabSize'].forEach((p) => {
      const v = cs.getPropertyValue(p);
      if (v) div.style.setProperty(p, v);
    });
    div.style.position = 'absolute';
    div.style.top = '-9999px';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.overflowWrap = 'break-word';
    div.style.width = editor.clientWidth + 'px';
    div.textContent = lines.slice(0, lineIdx).join('\n');
    document.body.appendChild(div);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const targetTop = Math.max(0, div.scrollHeight - padTop - 8);
    document.body.removeChild(div);
    animateScroll(editor, targetTop);
  }

  function buildOutline() {
    const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
      outlineBody.innerHTML = '<div style="padding:16px;color:var(--text-muted);text-align:center;font-size:13px;">暂无标题</div>';
      return;
    }
    const srcHeadings = getSourceHeadings();
    let srcPtr = 0;
    let html = '';
    headings.forEach((h, i) => {
      const level = parseInt(h.tagName[1]);
      const text = h.textContent.replace(/^[\d.]+\s*/, '').trim();
      if (!h.id) h.id = 'heading-' + i;

      // Map the rendered heading back to its line in the markdown source
      let srcLine = -1;
      for (let j = srcPtr; j < srcHeadings.length; j++) {
        if (srcHeadings[j].level === level && normHeading(srcHeadings[j].text) === normHeading(text)) {
          srcLine = srcHeadings[j].line;
          srcPtr = j + 1;
          break;
        }
      }
      if (srcLine === -1 && srcHeadings[i]) srcLine = srcHeadings[i].line;

      html += `<a class="outline-item outline-level-${level}" data-target="${h.id}" data-line="${srcLine}" title="${escapeHtml(text)}">${escapeHtml(text)}</a>`;
    });
    outlineBody.innerHTML = html;

    // Click to scroll: jump BOTH the preview (right) and the editor (left)
    outlineBody.querySelectorAll('.outline-item').forEach((item) => {
      item.addEventListener('click', () => {
        outlineBody.querySelectorAll('.outline-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');

        // Keep the two-way sync quiet while we jump both panes
        suppressSync(600);

        // 1) Editor pane -> corresponding markdown source line
        const line = parseInt(item.dataset.line, 10);
        if (!isNaN(line) && line >= 0) {
          const lines = editor.value.split('\n');
          let pos = 0;
          for (let k = 0; k < line; k++) pos += lines[k].length + 1;
          // Park the caret at the start of that line (no text selected, so
          // typing right after a jump never overwrites the heading)
          editor.setSelectionRange(pos, pos);
          scrollEditorToLine(line);
        }

        // 2) Preview pane -> the rendered heading
        const target = document.getElementById(item.dataset.target);
        if (target) {
          animateScroll(previewWrap, Math.max(0, offsetInPreview(target) - 12));
        }
      });
    });
  }

  function updateOutline() {
    if (!outlineVisible) return;
    buildOutline();
  }

  function toggleOutline() {
    outlineVisible = !outlineVisible;
    outlinePanel.classList.toggle('show', outlineVisible);
    $('#btnOutline').classList.toggle('active', outlineVisible);
    if (outlineVisible) buildOutline();
  }

  $('#btnOutline').addEventListener('click', toggleOutline);
  $('#outlineClose').addEventListener('click', toggleOutline);

  // Track active heading on preview scroll (previewWrap is the real scroll container)
  previewWrap.addEventListener('scroll', () => {
    if (!outlineVisible) return;
    const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) return;
    const scrollTop = previewWrap.scrollTop;
    let activeIdx = 0;
    headings.forEach((h, i) => {
      if (offsetInPreview(h) - 24 <= scrollTop) activeIdx = i;
    });
    outlineBody.querySelectorAll('.outline-item').forEach((item, i) => {
      item.classList.toggle('active', i === activeIdx);
    });
  });

  // Template modal
  $('#btnTemplate').addEventListener('click', () => {
    renderTemplateList();
    $('#templateModal').classList.add('show');
  });

  $('#modalClose').addEventListener('click', () => $('#templateModal').classList.remove('show'));

  $('#btnTemplateNew').addEventListener('click', () => {
    state.currentTemplate = null;
    $('#templateName').value = '';
    $('#templateContent').value = '# {{ content }}\n\n';
    renderTemplateList();
  });

  $('#btnTemplateSave').addEventListener('click', () => {
    const name = $('#templateName').value.trim();
    const content = $('#templateContent').value;
    if (!name) {
      showToast('请输入模板名称', 'error');
      return;
    }
    const templates = getTemplates();
    if (state.currentTemplate !== null && templates[state.currentTemplate]) {
      templates[state.currentTemplate] = { name, content };
    } else {
      templates.push({ name, content });
      state.currentTemplate = templates.length - 1;
    }
    saveTemplates(templates);
    renderTemplateList();
    showToast('模板已保存', 'success');
  });

  $('#btnTemplateDelete').addEventListener('click', () => {
    if (state.currentTemplate === null) {
      showToast('请先选择模板', 'error');
      return;
    }
    const templates = getTemplates();
    templates.splice(state.currentTemplate, 1);
    saveTemplates(templates);
    state.currentTemplate = null;
    $('#templateName').value = '';
    $('#templateContent').value = '';
    renderTemplateList();
    showToast('模板已删除');
  });

  $('#btnTemplateApply').addEventListener('click', () => {
    const content = $('#templateContent').value;
    if (!content) {
      showToast('请选择或输入模板内容', 'error');
      return;
    }
    const currentMd = editor.value;
    editor.value = content.replace(/\{\{\s*content\s*\}\}/g, currentMd);
    renderMarkdown();
    saveContent();
    $('#templateModal').classList.remove('show');
    showToast('模板已应用', 'success');
  });

  // Modal overlay click to close
  $('#templateModal').addEventListener('click', (e) => {
    if (e.target === $('#templateModal')) $('#templateModal').classList.remove('show');
  });
  $('#urlModal').addEventListener('click', (e) => {
    if (e.target === $('#urlModal')) $('#urlModal').classList.remove('show');
  });

  // Keyboard shortcuts
  editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); handleToolbar('bold'); }
      else if (key === 'i') { e.preventDefault(); handleToolbar('italic'); }
      else if (key === 'k' && !e.shiftKey) { e.preventDefault(); handleToolbar('link'); }
      else if (key === 'k' && e.shiftKey) { e.preventDefault(); handleToolbar('code'); }
      else if (key === 'c' && e.shiftKey) { e.preventDefault(); handleToolbar('codeblock'); }
      else if (key === 'u' && e.shiftKey) { e.preventDefault(); handleToolbar('ul'); }
      else if (key === 'o' && e.shiftKey) { e.preventDefault(); handleToolbar('ol'); }
      else if (key === 's') { e.preventDefault(); saveContent(); showToast('已保存', 'success'); }
    }
    // Tab support
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.setSelectionRange(start + 2, start + 2);
      renderMarkdown();
    }
  });

  // ===== Resizer =====
  const resizer = $('#resizer');
  const editorPanel = $('#editorPanel');
  const previewPanel = $('#previewPanel');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const container = $('.app-main');
    const rect = container.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const percentage = (offset / rect.width) * 100;
    if (percentage > 15 && percentage < 85) {
      editorPanel.style.flex = `0 0 ${percentage}%`;
      previewPanel.style.flex = `0 0 ${100 - percentage}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  // ===== HTML to Markdown =====
  function htmlToMarkdown(html) {
    // Create a temp element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove scripts and styles
    temp.querySelectorAll('script, style, nav, footer, header, aside, iframe').forEach((el) => el.remove());

    // Try to get main content
    const article = temp.querySelector('article') || temp.querySelector('main') || temp.querySelector('.content') || temp.querySelector('.post') || temp;

    let md = '';

    function processNode(node, depth = 0) {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          md += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          switch (tag) {
            case 'h1': md += `\n# ${child.textContent.trim()}\n\n`; break;
            case 'h2': md += `\n## ${child.textContent.trim()}\n\n`; break;
            case 'h3': md += `\n### ${child.textContent.trim()}\n\n`; break;
            case 'h4': md += `\n#### ${child.textContent.trim()}\n\n`; break;
            case 'h5': md += `\n##### ${child.textContent.trim()}\n\n`; break;
            case 'p': md += '\n'; processNode(child, depth + 1); md += '\n\n'; break;
            case 'br': md += '\n'; break;
            case 'strong': case 'b': md += '**'; processNode(child, depth + 1); md += '**'; break;
            case 'em': case 'i': md += '*'; processNode(child, depth + 1); md += '*'; break;
            case 'del': case 's': md += '~~'; processNode(child, depth + 1); md += '~~'; break;
            case 'a': md += `[${child.textContent}](${child.href})`; break;
            case 'img': md += `![${child.alt || ''}](${child.src})`; break;
            case 'code':
              if (child.parentElement && child.parentElement.tagName.toLowerCase() === 'pre') {
                const lang = child.className.match(/language-(\w+)/);
                md += `\n\`\`\`${lang ? lang[1] : ''}\n${child.textContent}\n\`\`\`\n\n`;
              } else {
                md += `\`${child.textContent}\``;
              }
              break;
            case 'pre': processNode(child, depth + 1); break;
            case 'blockquote': md += '\n'; Array.from(child.children).forEach((c) => { md += `> ${c.textContent}\n`; }); md += '\n'; break;
            case 'ul':
              md += '\n';
              child.querySelectorAll(':scope > li').forEach((li) => { md += `- ${li.textContent.trim()}\n`; });
              md += '\n';
              break;
            case 'ol':
              md += '\n';
              let i = 1;
              child.querySelectorAll(':scope > li').forEach((li) => { md += `${i++}. ${li.textContent.trim()}\n`; });
              md += '\n';
              break;
            case 'hr': md += '\n---\n\n'; break;
            case 'table':
              md += '\n';
              child.querySelectorAll('tr').forEach((tr, ri) => {
                const cells = Array.from(tr.querySelectorAll('th, td')).map((c) => c.textContent.trim());
                md += `| ${cells.join(' | ')} |\n`;
                if (ri === 0) md += `| ${cells.map(() => '---').join(' | ')} |\n`;
              });
              md += '\n';
              break;
            default: processNode(child, depth + 1);
          }
        }
      });
    }

    processNode(article);
    return md.replace(/\n{3,}/g, '\n\n').trim();
  }

  // ===== Persistence =====
  function saveContent() {
    localStorage.setItem('mdtu-content', editor.value);
  }

  function loadContent() {
    const saved = localStorage.getItem('mdtu-content');
    editor.value = saved !== null ? saved : defaultContent;
  }

  // ===== Links / Resources Navigation =====
  const LINK_DATA = {
    tools: [
      { name: 'MDTU 码途编辑器', url: 'https://markdown.devtool.tech/app', desc: '本工具的原型，支持微信样式的在线 Markdown 编辑器' },
      { name: 'doocs/md 微信排版', url: 'https://md.doocs.org/', desc: '一键将 Markdown 转为公众号 / 知乎 / 掘金样式' },
      { name: 'MDNICE 编辑器', url: 'https://editor.mdnice.com/', desc: '老牌微信排版工具，主题与代码块样式丰富' },
      { name: 'StackEdit', url: 'https://stackedit.io/', desc: '功能全面的在线编辑器，支持云盘同步与导出' },
      { name: 'Dillinger', url: 'https://dillinger.io/', desc: '简洁的在线编辑器，可导出 HTML / PDF' },
      { name: 'Vditor 在线演示', url: 'https://b3log.org/vditor/demo/index.html', desc: '支持所见即所得 / 分屏 / 即时渲染三种模式' },
      { name: 'StackBlitz MD 预览', url: 'https://stackblitz.com/', desc: '在线运行前端项目，可快速预览 MD 渲染效果' },
      { name: 'Markdown 中文网', url: 'https://markdown.com.cn/', desc: 'Markdown 语法速查与入门教程' },
    ],
    oss: [
      { name: 'marked', url: 'https://github.com/markedjs/marked', desc: '本工具使用的解析引擎，轻量且高速' },
      { name: 'markdown-it', url: 'https://github.com/markdown-it/markdown-it', desc: '插件生态最丰富的 Markdown 解析器' },
      { name: 'ByteMD', url: 'https://github.com/bytedance/bytemd', desc: '字节跳动出品，可高度定制的编辑器框架' },
      { name: 'Vditor', url: 'https://github.com/Vanessa219/vditor', desc: '浏览器端的所见即所得 Markdown 编辑器' },
      { name: 'doocs/md', url: 'https://github.com/doocs/md', desc: '微信 Markdown 编辑器的开源实现' },
      { name: 'markdown-nice', url: 'https://github.com/mdnice/markdown-nice', desc: 'MDNICE 排版工具的开源版本' },
      { name: 'Cherry Markdown', url: 'https://github.com/Tencent/cherry-markdown', desc: '腾讯开源的 Markdown 编辑器，开箱即用' },
      { name: 'Toast UI Editor', url: 'https://github.com/nhn/tui.editor', desc: '遵循 GFM 标准的所见即所得编辑器' },
      { name: 'Milkdown', url: 'https://github.com/Milkdown/milkdown', desc: '基于 ProseMirror 的插件化编辑器' },
      { name: 'Editor.md', url: 'https://github.com/pandao/editor.md', desc: '经典国产开源 Markdown 编辑器' },
      { name: 'Docsify', url: 'https://github.com/docsifyjs/docsify', desc: '运行时驱动的文档站生成器，无需构建' },
      { name: 'VitePress', url: 'https://github.com/vuejs/vitepress', desc: 'Vite 驱动的静态站点生成器，适合文档与博客' },
    ],
    syntax: [
      { name: 'Mermaid Live Editor', url: 'https://mermaid.live/', desc: '在线编写并预览流程图、时序图、类图' },
      { name: 'KaTeX 官方站', url: 'https://katex.org/', desc: '在线数学公式渲染演示与语法支持列表' },
      { name: 'Mermaid 源码', url: 'https://github.com/mermaid-js/mermaid', desc: '文本生成图表的开源库' },
      { name: 'KaTeX 源码', url: 'https://github.com/KaTeX/KaTeX', desc: '快速易用的 Web 数学公式渲染库' },
      { name: 'Markdown 表格生成器', url: 'https://www.tablesgenerator.com/markdown_tables', desc: '可视化编辑并生成 Markdown 表格' },
      { name: 'highlight.js', url: 'https://github.com/highlightjs/highlight.js', desc: '本工具使用的代码高亮库' },
    ],
  };

  function renderLinks(cat) {
    const list = $('#linksList');
    list.innerHTML = LINK_DATA[cat].map((it) => `
      <a class="link-card" href="${it.url}" target="_blank" rel="noopener noreferrer">
        <div class="link-card-main">
          <span class="link-card-name">${escapeHtml(it.name)}</span>
          <span class="link-card-desc">${escapeHtml(it.desc)}</span>
          <span class="link-card-url">${escapeHtml(it.url.replace(/^https?:\/\//, ''))}</span>
        </div>
        <svg class="link-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>`).join('');
  }

  $('#btnLinks').addEventListener('click', () => {
    renderLinks('tools');
    document.querySelectorAll('.links-tab').forEach((t) => t.classList.toggle('active', t.dataset.cat === 'tools'));
    $('#linksModal').classList.add('show');
  });
  $('#linksModalClose').addEventListener('click', () => $('#linksModal').classList.remove('show'));
  $('#linksModal').addEventListener('click', (e) => {
    if (e.target === $('#linksModal')) $('#linksModal').classList.remove('show');
  });
  document.querySelectorAll('.links-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.links-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderLinks(tab.dataset.cat);
    });
  });

  // ===== Watermark Settings =====
  const wmForm = $('#watermarkModal');

  function wmReadForm() {
    return {
      enabled: $('#wmEnabled').checked,
      text: $('#wmText').value.trim(),
      color: $('#wmColor').value,
      fontSize: parseInt($('#wmFontSize').value, 10),
      opacity: parseInt($('#wmOpacity').value, 10),
      angle: parseInt($('#wmAngle').value, 10),
      gap: parseInt($('#wmGap').value, 10),
      onCopy: $('#wmOnCopy').checked,
    };
  }

  function wmUpdateLabels() {
    $('#wmFontSizeVal').textContent = $('#wmFontSize').value + 'px';
    $('#wmOpacityVal').textContent = $('#wmOpacity').value + '%';
    $('#wmAngleVal').textContent = $('#wmAngle').value + '°';
    $('#wmGapVal').textContent = $('#wmGap').value + 'px';
  }

  function wmRenderPreview() {
    const cfg = wmReadForm();
    const box = $('#wmPreviewBox');
    // Ignore the enabled flag here — the preview box always shows what the text looks like
    box.style.backgroundImage = buildWatermarkUrl(Object.assign({}, cfg, { enabled: true }));
  }

  function wmFillForm(cfg) {
    const c = cfg || watermark;
    $('#wmEnabled').checked = c.enabled;
    $('#wmText').value = c.text;
    $('#wmColor').value = c.color;
    $('#wmFontSize').value = c.fontSize;
    $('#wmOpacity').value = c.opacity;
    $('#wmAngle').value = c.angle;
    $('#wmGap').value = c.gap;
    $('#wmOnCopy').checked = c.onCopy;
    wmUpdateLabels();
    wmRenderPreview();
  }

  function wmOpen() {
    wmFillForm();
    wmForm.classList.add('show');
    setTimeout(() => $('#wmText').focus(), 50);
  }

  function wmClose() {
    wmForm.classList.remove('show');
  }

  function wmApply() {
    const cfg = wmReadForm();
    if (cfg.enabled && !cfg.text) {
      showToast('请先填写水印文字', 'error');
      $('#wmText').focus();
      return;
    }
    watermark = cfg;
    saveWatermark();
    applyWatermark();
    wmClose();
    showToast(isWatermarkActive(watermark) ? '水印已应用' : '水印已关闭', 'success');
  }

  $('#btnWatermark').addEventListener('click', wmOpen);
  $('#watermarkModalClose').addEventListener('click', wmClose);
  $('#wmCancel').addEventListener('click', wmClose);
  $('#wmApply').addEventListener('click', wmApply);
  wmForm.addEventListener('click', (e) => {
    if (e.target === wmForm) wmClose();
  });

  $('#wmReset').addEventListener('click', () => {
    // Only resets the form; the config is not touched until the user clicks 应用
    wmFillForm(Object.assign({}, WM_DEFAULTS));
    showToast('已恢复默认参数，点击「应用」生效');
  });

  wmForm.addEventListener('input', (e) => {
    if (e.target.type === 'range' || e.target.type === 'color') wmUpdateLabels();
    if (e.target.id === 'wmText' || e.target.type === 'range' || e.target.type === 'color') {
      wmRenderPreview();
    }
  });

  $('#wmPresets').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-text]');
    if (!btn) return;
    $('#wmText').value = btn.dataset.text;
    wmRenderPreview();
  });

  $('#watermarkModal').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') wmClose();
    if (e.key === 'Enter' && e.target.id === 'wmText') wmApply();
  });

  // ===== Init =====
  function init() {
    loadContent();
    applyDevice(pickSaved('mdtu-device', DEVICE_IDS, 'pc'));
    // 平台档已并入设备档，清掉旧存档键，免得留着让人以为还能选
    try { localStorage.removeItem('mdtu-platform'); } catch (e) { /* 隐私模式等场景忽略 */ }
    applyTheme(state.theme);
    applyWatermark();
    $('#btnPreviewScroll').classList.add('active');
    renderMarkdown();
    editor.focus();
    // focus() 会把光标滚入视口，同步滚动再按比例把预览一起带偏，
    // 表现为「一打开文档就不在开头」。显式把两个滚动容器拉回顶部。
    suppressSync();
    editor.scrollTop = 0;
    previewWrap.scrollTop = 0;
  }

  // Wait for libraries
  if (typeof marked === 'undefined' || typeof hljs === 'undefined') {
    setTimeout(init, 500);
  } else {
    init();
  }

})();
