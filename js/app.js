/* ============================================================
 * MDTU 码途编辑器 - 本地版
 * 基于 marked / highlight.js / KaTeX / Mermaid
 * ============================================================ */

(function () {
  'use strict';

  // ===== State =====
  const state = {
    theme: localStorage.getItem('mdtu-theme') || 'github',
    autoNumber: false,
    gridBg: false,
    syncScroll: true,
    currentTemplate: null,
    footnoteLinks: false,
  };

  // ===== Elements =====
  const $ = (sel) => document.querySelector(sel);
  const editor = $('#editor');
  const preview = $('#preview');
  const previewWrap = $('#previewWrap');
  const themeSelect = $('#themeSelect');
  const charCount = $('#charCount');
  const wordCount = $('#wordCount');
  const lineCount = $('#lineCount');
  const toast = $('#toast');

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
    breaks: false,
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

  // ===== Render Function =====
  function renderMarkdown() {
    const md = editor.value;

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

  // ===== Math Rendering =====
  function renderMath() {
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
    const lines = md.split('\n');
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
    const currentMd = editor.value;
    const tocRegex = /<!-- TOC -->[\s\S]*?<!-- \/TOC -->/;
    if (tocRegex.test(currentMd)) {
      editor.value = currentMd.replace(tocRegex, tocLines.join('\n'));
    } else {
      // Insert at the beginning
      editor.value = tocLines.join('\n') + '\n\n' + currentMd;
    }
    renderMarkdown();
    showToast('目录已插入');
  }

  // ===== Update Counts =====
  function updateCounts() {
    const text = editor.value;
    charCount.textContent = `${text.length} 字符`;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    wordCount.textContent = `${words} 词`;
    lineCount.textContent = `${text.split('\n').length} 行`;
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
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('mdtu-theme', theme);
    preview.className = `markdown-body theme-${theme}${state.gridBg ? ' grid-bg' : ''}`;
    themeSelect.value = theme;
  }

  // ===== Copy to Clipboard (Rich Text) =====
  function copyToClipboard() {
    // Clone the preview for copying
    const clone = preview.cloneNode(true);
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
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('已复制 HTML 到剪贴板', 'success');
    } catch (err) {
      showToast('复制失败', 'error');
    }
    document.body.removeChild(textarea);
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
        blockquote { padding: 0 16px; color: #57606a; border-left: .25em solid #d0d7de; margin: 0 0 16px; }
        table { border-collapse: collapse; }
        table th, table td { padding: 6px 13px; border: 1px solid #d0d7de; }
        table th { background: #f6f8fa; font-weight: 600; }
        table tr:nth-child(2n) { background: #f6f8fa; }`,
      shanchui: `body, div { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.8; color: #3f3f3f; }
        h1 { font-size: 1.8em; font-weight: bold; text-align: center; color: #66CCFF; border-bottom: 2px solid #66CCFF; padding-bottom: 10px; }
        h2 { font-size: 1.4em; font-weight: bold; color: #66CCFF; border-left: 5px solid #66CCFF; padding-left: 12px; margin: 30px 0 16px; }
        h3 { font-size: 1.2em; font-weight: bold; color: #555; }
        p { margin: 0 0 16px; }
        a { color: #66CCFF; text-decoration: none; border-bottom: 1px solid #66CCFF; }
        code { font-size: 90%; padding: 2px 6px; background: rgba(102,204,255,.12); color: #e83e8c; border-radius: 3px; font-family: Consolas, monospace; }
        pre { padding: 16px; border-radius: 4px; background: #2d2d2d; }
        pre code { padding: 0; background: none; color: #f8f8f2; }
        blockquote { padding: 10px 16px; background: rgba(102,204,255,.08); border-left: 4px solid #66CCFF; color: #666; }
        table { border-collapse: collapse; }
        table th, table td { padding: 8px 12px; border: 1px solid #e0e0e0; }
        table th { background: rgba(102,204,255,.1); }`,
      shanyue: `body, div { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.75; color: #2c3e50; }
        h1 { font-size: 1.7em; font-weight: 700; color: #1a1a1a; text-align: center; }
        h2 { font-size: 1.35em; font-weight: 700; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 30px 0 14px; }
        h3 { font-size: 1.15em; font-weight: 600; color: #333; }
        p { margin: 0 0 14px; }
        a { color: #42b983; text-decoration: none; }
        code { font-size: 90%; padding: 2px 6px; background: #f0f0f0; color: #d63200; border-radius: 3px; font-family: Consolas, monospace; }
        pre { padding: 14px 16px; border-radius: 4px; background: #282c34; }
        pre code { padding: 0; background: none; color: #abb2bf; }
        blockquote { padding: 10px 16px; background: #f8f8f8; border-left: 4px solid #42b983; color: #666; }
        table { border-collapse: collapse; }
        table th, table td { padding: 8px 12px; border: 1px solid #e8e8e8; }
        table th { background: #42b983; color: #fff; }`,
      'condensed-night-purple': `body, div { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.75; color: #ddd6fe; background: #2d2d2d; }
        h1 { font-size: 1.8em; font-weight: bold; color: #a78bfa; text-align: center; border-bottom: 2px solid #4c1d95; padding-bottom: 10px; }
        h2 { font-size: 1.4em; font-weight: bold; color: #c4b5fd; border-left: 5px solid #7c3aed; padding-left: 12px; margin: 30px 0 16px; }
        h3 { font-size: 1.2em; font-weight: bold; color: #c4b5fd; }
        p { margin: 0 0 16px; }
        a { color: #a78bfa; text-decoration: none; border-bottom: 1px solid #7c3aed; }
        code { font-size: 90%; padding: 2px 6px; background: rgba(167,139,250,.2); color: #f0abfc; border-radius: 3px; font-family: Consolas, monospace; }
        pre { padding: 16px; border-radius: 4px; background: #1e1e2e; }
        pre code { padding: 0; background: none; color: #f0abfc; }
        blockquote { padding: 10px 16px; background: rgba(124,58,237,.15); border-left: 4px solid #7c3aed; color: #c4b5fd; }
        table { border-collapse: collapse; }
        table th, table td { padding: 8px 12px; border: 1px solid #4c1d95; }
        table th { background: rgba(124,58,237,.3); }`,
    };
    return styles[theme] || styles.github;
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
    preview.classList.toggle('grid-bg', state.gridBg);
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

  const escapeHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Collect ATX headings (and their line numbers) from the markdown source,
  // skipping anything inside fenced code blocks.
  function getSourceHeadings() {
    const lines = editor.value.split('\n');
    const out = [];
    let inFence = false;
    lines.forEach((line, idx) => {
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
    applyTheme(state.theme);
    applyWatermark();
    $('#btnPreviewScroll').classList.add('active');
    renderMarkdown();
    editor.focus();
  }

  // Wait for libraries
  if (typeof marked === 'undefined' || typeof hljs === 'undefined') {
    setTimeout(init, 500);
  } else {
    init();
  }

})();
