// ==UserScript==
// @name         Gemini to Markdown Exporter
// @namespace    https://github.com/faithleysath/gemini-to-markdown
// @version      1.4.0
// @description  Export Gemini reports, sources and Thinking to Markdown and self-contained offline HTML.
// @updateURL    https://raw.githubusercontent.com/youyouhdhd/gemini-to-markdown/refs/heads/deep-research-archive/gemini-to-markdown.user.js
// @downloadURL  https://raw.githubusercontent.com/youyouhdhd/gemini-to-markdown/refs/heads/deep-research-archive/gemini-to-markdown.user.js
// @author       faithleysath
// @match        https://gemini.google.com/*
// @match        https://*.scf.usercontent.goog/gemini-code-immersive/shim.html*
// @icon         https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg
// @grant        none
// @run-at       document-start
// @license      MIT
// ==/UserScript==

/*
MIT License

Copyright (c) 2026 吴天一

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(function () {
  const previewSelector = 'web-preview iframe[src*="/gemini-code-immersive/shim.html"]';
  const previewMessage = "gemini-to-markdown:preview-html";
  const maxPreviewSize = 1000000;
  const geminiOrigin = "https://gemini.google.com";

  function isPreview(url) {
    return url.protocol === "https:" && !url.port && url.hostname.endsWith(".scf.usercontent.goog") &&
      url.pathname === "/gemini-code-immersive/shim.html";
  }

  if (isPreview(new URL(location.href))) {
    if (window.parent === window) return;
    // Gemini sends the HTML to its shim before navigating the frame to its blob URL.
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent || event.origin !== geminiOrigin) return;
      const { body, mimeType } = event.data || {};
      if (typeof mimeType !== "string" || !/^text\/html(?:;|$)/i.test(mimeType)) return;
      const html = typeof body === "string" ? body : body instanceof ArrayBuffer
        ? (body.byteLength <= maxPreviewSize ? new TextDecoder().decode(body) : "") : "";
      if (html.length && html.length <= maxPreviewSize) {
        window.parent.postMessage({ type: previewMessage, html }, geminiOrigin);
      }
    });
    return;
  }

  if (location.origin !== geminiOrigin || window.parent !== window) return;
  const previews = new WeakMap();
  window.addEventListener("message", (event) => {
    const { type, html } = event.data || {};
    if (type !== previewMessage || typeof html !== "string" || !html.length || html.length > maxPreviewSize) return;
    const frame = Array.from(document.querySelectorAll(previewSelector)).find((element) => {
      const url = new URL(element.src);
      return isPreview(url) && url.origin === event.origin && element.contentWindow === event.source;
    });
    if (frame) previews.set(frame, { url: frame.src, html });
  });

  function mdLink(label, url) {
    const text = escapeHtml(label).replace(/[\\`*_|]/g, "\\$&").replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
    return `[${text}](<${url.replace(/[<>|\\]/g, encodeURIComponent)}>)`;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const groups = [["Sources used in the report", ".used-sources"], ["Sources browsed but not used", ".unused-sources"]];
  const ignoredTags = new Set(["SOURCES-CAROUSEL-INLINE", "SOURCES-CAROUSEL", "DEEP-RESEARCH-SOURCE-LISTS", "WEB-PREVIEW", "THINKING-PANEL", "MODEL-THOUGHTS", "BUTTON", "MAT-ICON", "STYLE", "SCRIPT", "SVG"]);

  function researchSources(root) {
    const owner = root.closest("response-container, .response-container-content");
    const lists = root.querySelector("deep-research-source-lists") || owner?.querySelector("deep-research-source-lists");
    const read = (selector) => Array.from(lists?.querySelectorAll(`${selector} browse-web-item`) || [], (item) => {
      const link = item.querySelector("a[href]");
      if (!link || !/^https?:$/.test(link.protocol)) return null;
      const title = link.querySelector('[data-test-id="sub-title"]')?.textContent.trim().replace(/\s+/g, " ");
      return { href: link.href, title: title || link.hostname };
    });
    const sources = groups.map(([heading, selector]) => [heading, read(selector)]);
    const appendix = sources
      .filter(([, links]) => links.length)
      .map(([heading, links]) => `## ${heading}\n\n${links.map((link, i) => `${i + 1}. ${link ? mdLink(link.title, link.href) : "Source unavailable"}`).join("\n")}`)
      .join("\n\n");
    const appendixHtml = sources.filter(([, links]) => links.length).map(([heading, links]) =>
      `<h2>${heading}</h2><ol>${links.map((link) => `<li>${link ? `<a href="${escapeHtml(link.href)}">${escapeHtml(link.title)}</a>` : 'Source unavailable'}</li>`).join('')}</ol>`,
    ).join('');
    return { used: sources[0][1], appendix, appendixHtml };
  }

  function readThinking(root) {
    const owner = root.closest('deep-research-immersive-panel') || root.closest('response-container, .response-container, model-response') || root;
    const markdown = [], html = [];
    for (const item of owner.querySelectorAll('thinking-panel .item-container')) {
      const note = item.querySelector('thought-item');
      if (note) {
        const title = note.querySelector('.thought-header')?.textContent.trim();
        const text = note.querySelector('.gds-body-m.gds-italic:not(.thought-header)')?.textContent.trim();
        if (title) {
          markdown.push(`#### ${title.replace(/\s+/g, ' ')}`);
          html.push(`<h4>${escapeHtml(title)}</h4>`);
        }
        if (text) {
          markdown.push(text);
          html.push(`<p>${escapeHtml(text).replace(/\r?\n/g, '<br>')}</p>`);
        }
      }
      const links = Array.from(item.querySelectorAll('browse-web-chip a[data-test-id="browse-chip-link"][href]'))
        .filter((link) => /^https?:$/.test(link.protocol))
        .map((link) => ({
          href: link.href,
          title: link.querySelector('[data-test-id="title"]')?.textContent.trim().replace(/\s+/g, ' ') || link.hostname,
        }));
      if (links.length) {
        markdown.push('#### Researched websites', links.map(({ title, href }) => `- ${mdLink(title, href)}`).join('\n'));
        html.push(`<h4>Researched websites</h4><ul>${links.map(({ title, href }) => `<li><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></li>`).join('')}</ul>`);
      }
    }
    return { markdown: markdown.length ? ['## Thinking', ...markdown].join('\n\n') : '', html: html.length ? `<section><h2>Thinking</h2>${html.join('')}</section>` : '' };
  }

  function previewFrame(label, html) {
    const style = '<style>html,body{overflow:auto!important}</style>';
    const ending = /<\/head\s*>/i;
    const source = html.replace(/<script\b[^>]*\bdata-bard-client-injected\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    const scrollable = ending.test(source) ? source.replace(ending, `${style}</head>`) : `<!doctype html>${style}${source.replace(/^\s*<!doctype html\s*>/i, '')}`;
    return `<iframe class="preview-frame" title="${escapeHtml(label)}" sandbox="allow-scripts" srcdoc="${escapeHtml(scrollable)}"></iframe>`;
  }

  function offlineHtml(title, content, css) {
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'; frame-src about:">
<title>${escapeHtml(title)}</title><style>${css}</style><body>${content}</body>`;
  }

  function archiveReportHtml(target, positions, thinking) {
    const { used, appendixHtml } = researchSources(target);
    const allowed = new Set('a b blockquote br caption code dd del details div dl dt em h1 h2 h3 h4 h5 h6 hr i img li ol p pre s span strong sub summary sup table tbody td th thead tfoot tr ul'.split(' '));
    const render = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent);
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      if (node.localName === 'web-preview') return positions.get(node)?.map((preview) => preview.html).join('') || '';
      if (ignoredTags.has(node.tagName) || node.classList.contains('gemini-export-float-btn')) return '';
      const tag = node.localName;
      const index = node.getAttribute('data-turn-source-index');
      if (tag === 'sup' && /^[1-9]\d*$/.test(index || '')) {
        const source = used[Number(index) - 1];
        const label = `[${index}]`;
        return `<sup>${source ? `<a href="${escapeHtml(source.href)}">${label}</a>` : label}</sup>`;
      }
      const math = node.getAttribute('data-math');
      if (math) return `<code>${escapeHtml(math)}</code>`;
      const content = Array.from(node.childNodes, render).join('');
      if (!allowed.has(tag)) return content;
      if (tag === 'a') return /^https?:$/.test(node.protocol) ? `<a href="${escapeHtml(node.href)}">${content}</a>` : content;
      if (tag === 'img') return `<img alt="${escapeHtml(node.alt)}" src="${escapeHtml(node.src)}">`;
      if (tag === 'hr' || tag === 'br') return `<${tag}>`;
      return `<${tag}>${content}</${tag}>`;
    };
    const title = target.querySelector('h1')?.textContent.trim() || 'Gemini report';
    return offlineHtml(title, `<main>${render(target)}${appendixHtml}${thinking}</main>`, `
:root{color-scheme:light dark;font:16px/1.65 system-ui,sans-serif}
main{max-width:1120px;margin:auto;padding:1.5rem}a{overflow-wrap:anywhere}img{max-width:100%}
pre,table{display:block;overflow:auto}td,th{padding:.35rem;border:1px solid #8886}
.web-preview{margin:1.5rem 0}.web-preview figcaption{margin-bottom:.4rem;font-weight:600}
.preview-frame{display:block;width:100%;height:80vh;border:1px solid #8886;background:white}`);
  }

  // A STORE-only ZIP keeps the script standalone. The bounded preview files fit in ZIP32.
  function archive(entries) {
    const local = [], central = [];
    const encoder = new TextEncoder();
    let offset = 0, centralSize = 0;
    const ints = (length) => new DataView(new ArrayBuffer(length));
    const word = (view, at, value) => view.setUint16(at, value, true);
    const dword = (view, at, value) => view.setUint32(at, value, true);
    for (const [name, content] of entries) {
      const filename = encoder.encode(name), bytes = encoder.encode(content);
      let crc = -1;
      for (const byte of bytes) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
      const a = ints(30), b = ints(46);
      dword(a, 0, 0x04034b50);
      word(a, 4, 20);
      word(a, 6, 0x800);
      word(a, 12, 33);
      dword(a, 14, ~crc);
      dword(a, 18, bytes.length);
      dword(a, 22, bytes.length);
      word(a, 26, filename.length);
      dword(b, 0, 0x02014b50);
      word(b, 4, 20);
      new Uint8Array(b.buffer, 6, 26).set(new Uint8Array(a.buffer, 4, 26));
      dword(b, 42, offset);
      local.push(a.buffer, filename, bytes);
      central.push(b.buffer, filename);
      offset += a.byteLength + filename.length + bytes.length;
      centralSize += b.byteLength + filename.length;
    }
    const end = ints(22);
    dword(end, 0, 0x06054b50);
    word(end, 8, entries.length);
    word(end, 10, entries.length);
    dword(end, 12, centralSize);
    dword(end, 16, offset);
    return new Blob([...local, ...central, end.buffer], { type: "application/zip" });
  }
  if (window.__GEMINI_EXPORT_TIMER__) {
    clearInterval(window.__GEMINI_EXPORT_TIMER__);
  }
  // === 终极通用版：HTML 转 Markdown ===
  // 兼容：ProseMirror 编辑器、Angular 前端、常见 AI 对话界面
  function htmlToMarkdown(rootElement, positions) {
    if (!rootElement) return "";
    const { used, appendix } = researchSources(rootElement);

    // 定义需要忽略的 UI 噪音标签 (Type 2 特有)

    function traverse(node, context = {}) {
      // 1. 文本节点处理
      if (node.nodeType === Node.TEXT_NODE) {
        if (context.inPre) return node.textContent; // 代码块内保留所有格式
        // 压缩多余空格，但保留单词间的空格
        return node.textContent.replace(/\n/g, " ").replace(/\s+/g, " ");
      }

      // 2. 元素节点处理
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toUpperCase();
      if (tag === 'WEB-PREVIEW') {
        const links = positions?.get(node)?.map((preview) => preview.link).join('\n\n');
        return links ? `\n\n${links}\n\n` : '';
      }

      // 遇到噪音标签直接忽略
      if (ignoredTags.has(tag)) return "";

      // 忽略 ProseMirror 的末尾占位符 (Type 1 特有)
      if (node.classList.contains("ProseMirror-trailingBreak")) return "";

      // 穿透容器标签 (如 response-element)
      if (tag === "RESPONSE-ELEMENT") {
        let inner = "";
        node.childNodes.forEach((child) => (inner += traverse(child, context)));
        return inner;
      }

      // === 核心逻辑：数学公式 (兼容 Type 1 & Type 2) ===
      // 只要有 data-math 属性，优先提取 LaTeX，跳过内部复杂的渲染 DOM
      if (node.hasAttribute("data-math")) {
        const latex = node.getAttribute("data-math");
        // 判断是否为块级公式：
        // 1. tag 是 MATH-BLOCK (Type 1)
        // 2. class 包含 math-block (Type 1 & 2)
        // 3. display 样式为 block
        const isBlock =
          tag === "MATH-BLOCK" ||
          node.classList.contains("math-block") ||
          node.style.display === "block";

        if (isBlock) {
          return `\n\n$$\n${latex}\n$$\n\n`;
        } else {
          return `$${latex}$`;
        }
      }

      // === 特殊元素映射 ===

      // 任务列表复选框 (Type 1 特有)
      if (tag === "INPUT" && node.type === "checkbox") {
        return node.checked ? "[x] " : "[ ] ";
      }

      // 引用角标 (Type 2 特有)
      if (tag === "SUP" && node.hasAttribute("data-turn-source-index")) {
        const index = node.getAttribute("data-turn-source-index");
        if (!/^[1-9]\d*$/.test(index)) return node.textContent || "";
        const url = used[Number(index) - 1]?.href;
        const label = `[${index}]`;
        return url ? `[${label}](<${url.replace(/[<>|\\]/g, encodeURIComponent)}>)` : label;
      }

      // 图片
      if (tag === "IMG") {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        return `![${alt}](${src})`;
      }

      // 换行与分割线
      if (tag === "BR") return "  \n";
      if (tag === "HR") return "\n\n---\n\n";

      // 代码块 (兼容 Type 1 PRE & Type 2 CODE-BLOCK)
      if (tag === "CODE-BLOCK" || tag === "PRE") {
        const codeEl = node.querySelector("code") || node; // 优先找内部 code，找不到用自身
        let lang = "";
        // 尝试从 class="language-xyz" 获取语言
        const langMatch = (codeEl.className || "").match(
          /language-([a-z0-9]+)/i,
        );
        lang = langMatch ? langMatch[1] : "";

        // 获取内容 (innerText 在某些浏览器处理换行更好)
        const content = codeEl.innerText || codeEl.textContent;
        return `\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n`;
      }

      // 表格 (通用)
      if (tag === "TABLE") {
        const rows = Array.from(node.querySelectorAll("tr"));
        let mdTable = "\n";
        rows.forEach((row, i) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          const rowText =
            "| " +
            cells.map((c) => traverse(c, context).trim()).join(" | ") +
            " |";
          mdTable += rowText + "\n";
          // 表头分隔线
          if (i === 0) {
            mdTable +=
              "| " +
              cells
                .map((cell) => {
                  const style = cell.getAttribute("style") || "";
                  if (style.includes("center")) return ":---:";
                  if (style.includes("right")) return "---:";
                  return "---";
                })
                .join(" | ") +
              " |\n";
          }
        });
        return mdTable + "\n";
      }

      // === 递归遍历子元素 ===
      let childrenContent = "";
      // 标记是否在 PRE/CODE 内部，避免二次处理
      const newContext = {
        ...context,
        inPre: context.inPre || tag === "PRE" || tag === "CODE-BLOCK",
        inList: context.inList || tag === "LI",
      };

      node.childNodes.forEach((child) => {
        childrenContent += traverse(child, newContext);
      });

      // === 包装容器格式化 ===
      switch (tag) {
        case "H1":
          return `\n# ${childrenContent}\n`;
        case "H2":
          return `\n## ${childrenContent}\n`;
        case "H3":
          return `\n### ${childrenContent}\n`;
        case "H4":
          return `\n#### ${childrenContent}\n`;
        case "H5":
          return `\n##### ${childrenContent}\n`;

        case "P":
          // 列表内的 P 标签不强制双换行，普通 P 需要
          if (context.inList) return childrenContent;
          return `\n${childrenContent}\n`;

        case "STRONG":
        case "B":
          return `**${childrenContent}**`;

        case "EM":
        case "I":
          return `*${childrenContent}*`;

        case "DEL":
        case "S":
          return `~~${childrenContent}~~`;

        case "CODE":
          if (context.inPre) return childrenContent;
          return `\`${childrenContent}\``;

        case "BLOCKQUOTE":
          // 处理多行引用的每一行
          return `\n> ${childrenContent.trim().split("\n").join("\n> ")}\n`;

        case "UL":
        case "OL":
          return `\n${childrenContent}\n`;

        case "LI":
          const parent = node.parentElement;
          let prefix = "- ";
          if (parent && parent.tagName === "OL") {
            // 尝试计算有序列表索引
            const start = parseInt(parent.getAttribute("start")) || 1;
            const index = Array.from(parent.children)
              .filter((el) => el.tagName === "LI")
              .indexOf(node);
            prefix = `${start + index}. `;
          }
          return `${prefix}${childrenContent.trim()}\n`; // trim() 很重要，移除li内部可能存在的首尾换行

        case "A":
          const href = node.getAttribute("href");
          if (!href) return childrenContent;
          // 如果是锚点链接且没有内容，可能需要特殊处理，这里默认标准处理
          return `[${childrenContent}](${href})`;

        case "DETAILS":
          return `\n<details>\n${childrenContent}\n</details>\n`;

        case "SUMMARY":
          return `<summary>${childrenContent}</summary>\n`;

        default:
          return childrenContent;
      }
    }

    let result = traverse(rootElement);
    // 清理多余空行 (超过2个换行变成2个)
    return [result.replace(/\n{3,}/g, "\n\n").trim(), appendix].filter(Boolean).join("\n\n");
  }

  // === 主程序执行 ===
  
  // 1. 定义选择器
  const selectors = [
    ".markdown",
    ".ProseMirror",
    ".model-response-text",
    "markdown-viewer"
  ];

  // 2. 定义扫描函数 (核心逻辑移到这里统一处理)
  let processedContainers = new WeakSet(); // 用于追踪已处理过的容器

  function scanAndAddButtons() {
    // 扫描所有目标选择器
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach((container, index) => {
        // 如果该容器未处理过，则添加按钮
        if (!processedContainers.has(container)) {
          // 二次检查：DOM中是否真的已有按钮（防止WeakSet在某些极端情况下失效）
          if (!container.querySelector('.gemini-export-float-btn')) {
            createFloatingButton(container, processedContainers.size);
            processedContainers.add(container);
          }
        }
      });
    });
  }

  // 3. 立即启动定时器 (解决 SPA 动态加载问题)
  // Gemini 是动态网页，内容是后来加载的，必须依靠定时器或观察者
  window.__GEMINI_EXPORT_TIMER__ = setInterval(scanAndAddButtons, 1000);
  
  // 4. 尝试立即执行一次 (虽然大概率找不到，但为了保险)
  scanAndAddButtons();

  console.log('✅ Gemini Markdown Exporter 已启动，正在监听内容变化...');

  // === 以下保留原本的 createFloatingButton 及后续辅助函数 ===
  // ... (你的 createFloatingButton, copyToMarkdown 等函数保持不变)
  // === 创建悬浮按钮 ===
  function createFloatingButton(container, index) {
    // 检查是否已经创建过按钮
    if (container.querySelector('.gemini-export-float-btn')) {
      return;
    }

    // 确保容器有相对定位
    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.position === 'static') {
      container.style.position = 'relative';
    }

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'gemini-button-container';
    Object.assign(buttonContainer.style, {
      position: 'absolute',
      top: '-34px',
      right: '16px',
      zIndex: '1000',
      display: 'flex',
      gap: '8px',
    });

    // 创建复制按钮（幽灵按钮）
    const copyBtn = document.createElement('button');
    copyBtn.className = 'gemini-copy-float-btn';

    // 复制图标 SVG
    const copySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    copySvg.setAttribute("width", "14");
    copySvg.setAttribute("height", "14");
    copySvg.setAttribute("viewBox", "0 0 24 24");
    copySvg.setAttribute("fill", "none");
    copySvg.setAttribute("stroke", "currentColor");
    copySvg.setAttribute("stroke-width", "2.5");
    copySvg.setAttribute("stroke-linecap", "round");
    copySvg.setAttribute("stroke-linejoin", "round");
    copySvg.style.marginRight = "6px";

    const copyRect1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    copyRect1.setAttribute("x", "9");
    copyRect1.setAttribute("y", "9");
    copyRect1.setAttribute("width", "13");
    copyRect1.setAttribute("height", "13");
    copyRect1.setAttribute("rx", "2");
    copyRect1.setAttribute("ry", "2");
    copySvg.appendChild(copyRect1);

    const copyPath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    copyPath1.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
    copySvg.appendChild(copyPath1);

    copyBtn.appendChild(copySvg);

    const copySpan = document.createElement("span");
    copySpan.textContent = "Copy";
    copyBtn.appendChild(copySpan);

    // 检测暗黑模式
    const isDarkMode = document.body.classList.contains('dark-theme');

    // 根据主题设置按钮样式
    const buttonStyles = isDarkMode ? {
      background: 'rgba(30, 30, 30, 0.95)',
      color: '#e2e8f0',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
    } : {
      background: 'rgba(255, 255, 255, 0.95)',
      color: '#1e293b',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
    };

    const hoverStyles = isDarkMode ? {
      background: 'rgba(45, 45, 45, 0.98)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      color: '#ffffff',
    } : {
      background: '#ffffff',
      borderColor: '#cbd5e1',
      color: '#0f172a',
    };

    Object.assign(copyBtn.style, {
      padding: '8px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
      opacity: '0.6',
      ...buttonStyles,
    });

    // 复制按钮悬停效果
    copyBtn.addEventListener('mouseenter', () => {
      Object.assign(copyBtn.style, {
        transform: 'translateY(-1px)',
        boxShadow: isDarkMode
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        opacity: '1',
        ...hoverStyles,
      });
    });

    copyBtn.addEventListener('mouseleave', () => {
      Object.assign(copyBtn.style, {
        transform: 'translateY(0)',
        opacity: '0.6',
        ...buttonStyles,
      });
    });

    // 复制按钮点击事件
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyToMarkdown(container, copyBtn);
    });

    // 创建导出按钮
    const exportBtn = document.createElement('button');
    exportBtn.className = 'gemini-export-float-btn';

    // 使用 SVG 图标使其更美观 (使用 DOM 方法避免 innerHTML TrustedHTML 错误)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.marginRight = "6px";

    const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path1.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
    svg.appendChild(path1);

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", "7 10 12 15 17 10");
    svg.appendChild(polyline);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "12");
    line.setAttribute("y1", "15");
    line.setAttribute("x2", "12");
    line.setAttribute("y2", "3");
    svg.appendChild(line);

    exportBtn.appendChild(svg);

    const span = document.createElement("span");
    span.textContent = "Export";
    exportBtn.appendChild(span);

    Object.assign(exportBtn.style, {
      padding: '8px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
      opacity: '0.6',
      ...buttonStyles,
    });

    // 导出按钮悬停效果
    exportBtn.addEventListener('mouseenter', () => {
      Object.assign(exportBtn.style, {
        transform: 'translateY(-1px)',
        boxShadow: isDarkMode
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        opacity: '1',
        ...hoverStyles,
      });
    });

    exportBtn.addEventListener('mouseleave', () => {
      Object.assign(exportBtn.style, {
        transform: 'translateY(0)',
        opacity: '0.6',
        ...buttonStyles,
      });
    });

    // 点击事件 - 执行导出
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exportToMarkdown(container);
    });

    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(exportBtn);
    container.appendChild(buttonContainer);
    console.log(`✅ 悬浮按钮已添加到容器 ${index + 1}`);
  }

  async function copyToMarkdown(target, button) {
    try {
      await navigator.clipboard.writeText([htmlToMarkdown(target), readThinking(target).markdown].filter(Boolean).join('\n\n'));
      const label = button.querySelector("span");
      const oldLabel = label.textContent;
      label.textContent = "Copied!";
      setTimeout(() => { label.textContent = oldLabel; }, 1600);
    } catch (error) {
      console.error("Gemini Markdown copy failed:", error);
    }
  }

  function exportToMarkdown(target) {
    const entries = [];
    const positions = new Map();
    let remaining = 8000000;
    Array.from(target.querySelectorAll(previewSelector)).forEach((frame, index) => {
      const host = frame.closest('web-preview');
      if (!positions.has(host)) positions.set(host, []);
      const slots = positions.get(host);
      const preview = previews.get(frame);
      const label = preview?.html.match(/<title\b[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0, 200) || `Gemini web preview ${index + 1}`;
      if (preview?.url !== frame.src || preview.html.length > remaining) {
        slots.push({ link: `${label} (web preview unavailable)`, html: `<p>${escapeHtml(label)} (web preview unavailable)</p>` });
        return;
      }
      remaining -= preview.html.length;
      const path = `previews/web-preview-${index + 1}.html`;
      const rendered = previewFrame(label, preview.html);
      entries.push([path, offlineHtml(label, rendered, 'body{margin:0}.preview-frame{display:block;border:0;width:100%;height:100vh}')]);
      slots.push({ link: mdLink(label, path), html: `<figure class="web-preview"><figcaption>${escapeHtml(label)}</figcaption>${rendered}</figure>` });
    });
    const thinking = readThinking(target);
    const zipped = entries.length > 0;
    if (zipped) entries.push(['report.html', archiveReportHtml(target, positions, thinking.html)]);
    const markdown = [htmlToMarkdown(target, positions), thinking.markdown,
      zipped ? '[Open the offline HTML report](report.html)' : '',
    ].filter(Boolean).join("\n\n");
    const blob = zipped
      ? archive([["report.md", markdown], ...entries])
      : new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a = document.createElement("a");
    a.href = url;
    const rawTitle = document.title.replace(/(?:^|\s*[-–—|]\s*)(?:Google Gemini|Gemini)\s*$/i, '').trim() || target.querySelector('h1')?.textContent?.trim();
    const title = Array.from(rawTitle || '').slice(0, 50).join('').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim();
    a.download = `${title ? `${title}__` : ''}gemini_export_${timestamp}.${zipped ? "zip" : "md"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})();
