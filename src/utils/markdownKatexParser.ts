import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * 健壮的高性能 Markdown + KaTeX 解析器
 * 特性：
 * 1. 严格支持所有主流显式公式标记：
 *    - 块级公式：$$...$$, \[...\], \\[...\], \begin{...}...\end{...}
 *    - 行内公式：$...$, \(...\), \\(...\\)
 * 2. 具备智能裸 LaTeX 公式探测（Smart Bare-LaTeX Detection）：
 *    当 AI (ChatGPT / DeepSeek / Claude / Gemini) 在中日韩等文本中直接输出裸写公式（未包裹 $ 的 \frac{...}{...}、x \in (0, +\infty)、x_0、a^x = a \cdot a^{x-1}、\ln b = a \ln a、H_k(t) = \dots、k > 1 等）时，
 *    能精准识别中日韩（汉字、平假名、片假名、谚文及全角标点）边界并无损渲染为 KaTeX 数学公式。
 * 3. 严格排除普通英文单词短语，杜绝误伤。
 * 4. 完整支持 GFM 语法（多级标题、有序/无序列表、引用块、表格、粗体、斜体、删除线、代码块）。
 */

const CJK_CHARS =
  '\u4e00-\u9fff' + // 中日韩统一表意文字 (Kanji / Hanzi)
  '\u3400-\u4dbf' + // 扩展 A
  '\u3040-\u309f' + // 日语平假名 (Hiragana: を、に、は、の、と...)
  '\u30a0-\u30ff' + // 日语片假名 (Katakana: ア、イ、ウ...)
  '\uff66-\uff9f' + // 半角片假名
  '\uac00-\ud7af' + // 韩文谚文 (Hangul)
  '\u3000-\u303f' + // CJK 标点符号 (、。〃〈〉《》「」『』【】等)
  '\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65' + // 全角符号 (！，。：；（）等)
  '\u2014\u2018\u2019\u201c\u201d\u2026'; // 破折号、引号、省略号

const NON_CJK_REGEX = new RegExp(`([^${CJK_CHARS}\\n\\r]+)`, 'g');

const STANDARD_MATH_WORDS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min',
  'det', 'gcd', 'lcm', 'deg', 'dim', 'ker', 'hom',
  'arg', 'mod', 'sup', 'inf',
  'dx', 'dy', 'dz', 'dt', 'dr', 'ds'
]);

function isBareEnglishText(str: string): boolean {
  // 过滤掉所有带反斜杠的 LaTeX 宏命令，如 \frac, \ln, \log, \cdot, \text{...} 等
  let s = str.replace(/\\[a-zA-Z]+/g, ' ');
  // 过滤掉标准函数调用形式，如 f(x), g(x), H_b(u), f'(x)
  s = s.replace(/[a-zA-Z]\w*\x27?\s*\(/g, ' (');
  // 匹配剩余长度大于等于 2 的独立英文字词
  const words = s.match(/\b[a-zA-Z]{2,}\b/g) || [];
  const invalid = words.filter(w => !STANDARD_MATH_WORDS.has(w.toLowerCase()));
  return invalid.length > 0;
}

function isMathCandidate(candidate: string): boolean {
  const c = candidate.trim();
  if (!c || /^\d+(\.\d+)?$/.test(c)) return false;
  if (isBareEnglishText(c)) return false;

  const hasLatexCmd = /\\[a-zA-Z]+/.test(c);
  const hasSubOrSup = /[_^]/.test(c);
  const hasMathOp = /[=<>≤≥≠≈+\-*/]/.test(c) && /[a-zA-Z0-9]/.test(c);
  const hasFunction = /^[a-zA-Z]\x27?\(/.test(c);
  const hasInterval = /^\([a-zA-Z0-9+\-∞\\ ]+,\s*[a-zA-Z0-9+\-∞\\ ]+\)$/.test(c);
  const isSingleVar = /^[a-zA-Z]\x27?$/.test(c);

  if (hasLatexCmd || hasSubOrSup || hasMathOp || hasFunction || hasInterval || isSingleVar) {
    try {
      katex.renderToString(c, { displayMode: false, throwOnError: true, strict: false });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function renderMarkdownWithKatex(raw: string): string {
  if (!raw || !raw.trim()) return '';

  const tokenMap = new Map<string, string>();
  let tokenCounter = 0;

  function createToken(html: string): string {
    const id = `%%NAOSU_TOKEN_${tokenCounter++}_${Math.random().toString(36).substring(2, 8)}%%`;
    tokenMap.set(id, html);
    return id;
  }

  function renderKatexSafe(tex: string, displayMode: boolean): string {
    const trimmed = tex.trim();
    if (!trimmed) return '';
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: true,
      });
      if (displayMode) {
        return `<div class="katex-display-wrapper">${rendered}</div>`;
      }
      return `<span class="katex-inline-wrapper">${rendered}</span>`;
    } catch {
      return escapeHtml(trimmed);
    }
  }

  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. 保护多行代码块 ```lang ... ```
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return createToken(
      `<pre class="code-block${lang ? ' language-' + lang : ''}"><code>${escapeHtml(code)}</code></pre>`
    );
  });

  // 2. 保护行内代码 `...`
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    return createToken(`<code class="inline-code">${escapeHtml(code)}</code>`);
  });

  // 3. 显式块级公式: $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    return createToken(renderKatexSafe(tex, true));
  });

  // 显式块级公式: \[...\] 或 \\[...\\]
  text = text.replace(/(?:\\\[|\\\\\[)([\s\S]+?)(?:\\\]|\\\\\])/g, (_, tex) => {
    return createToken(renderKatexSafe(tex, true));
  });

  // 显式环境块: \begin{aligned}... 或 \begin{cases}...
  text = text.replace(
    /(\\begin\{(?:aligned|matrix|pmatrix|bmatrix|cases|equation|align\*?)\}[\s\S]+?\\end\{(?:aligned|matrix|pmatrix|bmatrix|cases|equation|align\*?)\})/g,
    (_, tex) => {
      return createToken(renderKatexSafe(tex, true));
    }
  );

  // 4. 显式行内公式: \(...\) 或 \\(...\\)
  text = text.replace(/(?:\\\(|\\\\\()([\s\S]+?)(?:\\\)|\\\\\))/g, (_, tex) => {
    return createToken(renderKatexSafe(tex, false));
  });

  // 显式行内公式: $...$
  text = text.replace(/\$([^\$\n\r]+?)\$/g, (match, tex) => {
    const trimmed = tex.trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) return match;
    return createToken(renderKatexSafe(trimmed, false));
  });

  // 5. 智能裸写数学公式探测（针对 AI 直接输出未包裹 $ 的 LaTeX / 数学符号）
  text = text.replace(NON_CJK_REGEX, (segment) => {
    if (segment.includes('%%NAOSU_TOKEN_')) return segment;

    let s = segment;
    // 保护行首序号（如 1. 2. ）、字母序号（如 a. B. ）以及列表项目符号（如 ◦ • ○ ● ▪ ▫ - * + 等）
    const leadMatch = s.match(/^(\s*(?:(?:\d+|[a-zA-Z])[\.\)]\s+|[◦•○●▪▫\-\*\+]\s+)?)/);
    let leading = leadMatch ? leadMatch[1] : '';
    let rest = s.slice(leading.length);

    const trailMatch = rest.match(/(\s+)$/);
    let trailing = trailMatch ? trailMatch[1] : '';
    let candidate = rest.slice(0, rest.length - trailing.length);

    // 剥离末尾孤立的标点（如句末英文句号、分号，但保留 ... 与 \dots）
    if (!candidate.endsWith('...') && !candidate.endsWith('\\dots') && !candidate.endsWith('\\cdots')) {
      const punctMatch = candidate.match(/([,;:!?.]+)$/);
      if (punctMatch) {
        trailing = punctMatch[1] + trailing;
        candidate = candidate.slice(0, candidate.length - punctMatch[1].length);
      }
    }

    // 平衡小括号：若开头带有未闭合的左括号或末尾带有未闭合的右括号，归还至前后文本
    let balance = 0;
    for (const ch of candidate) {
      if (ch === '(') balance++;
      else if (ch === ')') balance--;
    }
    while (balance > 0 && candidate.startsWith('(')) {
      leading += '(';
      candidate = candidate.slice(1).trim();
      balance--;
    }
    while (balance < 0 && candidate.endsWith(')')) {
      trailing = ')' + trailing;
      candidate = candidate.slice(0, -1).trim();
      balance++;
    }

    if (isMathCandidate(candidate)) {
      return `${leading}${createToken(renderKatexSafe(candidate, false))}${trailing}`;
    }
    return segment;
  });

  // 6. GFM 块元素逐行解析
  const lines = text.split('\n');
  const outputLines: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inBlockquote = false;

  function closeList() {
    if (inList) {
      outputLines.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      outputLines.push('</blockquote>');
      inBlockquote = false;
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 独立显式 Token 块（如显式代码块、display 级公式 div）直接输出，避免被 <p> 标签非法包裹
    if (/^\s*%%NAOSU_TOKEN_[^%]+%%\s*$/.test(line)) {
      closeList();
      closeBlockquote();
      outputLines.push(line.trim());
      i++;
      continue;
    }

    // 水平分割线 --- / *** / ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      closeList();
      closeBlockquote();
      outputLines.push('<hr class="md-divider" />');
      i++;
      continue;
    }

    // 表格解析 (| a | b |\n| --- | --- |)
    if (
      line.trim().startsWith('|') &&
      line.trim().endsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|?\s*[-:]+[-| :]*\|\s*$/.test(lines[i + 1])
    ) {
      closeList();
      closeBlockquote();
      const headerCols = line
        .split('|')
        .slice(1, -1)
        .map((c) => parseInline(c.trim()));
      i += 2;

      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const cols = lines[i]
          .split('|')
          .slice(1, -1)
          .map((c) => parseInline(c.trim()));
        bodyRows.push(cols);
        i++;
      }

      let tableHtml = '<div class="md-table-wrapper"><table class="md-table"><thead><tr>';
      for (const col of headerCols) {
        tableHtml += `<th>${col}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (const row of bodyRows) {
        tableHtml += '<tr>';
        for (let c = 0; c < headerCols.length; c++) {
          tableHtml += `<td>${row[c] || ''}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table></div>';
      outputLines.push(tableHtml);
      continue;
    }

    // 标题 # ~ ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      closeBlockquote();
      const level = headingMatch[1].length;
      outputLines.push(`<h${level} class="md-heading md-h${level}">${parseInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // 引用块 >
    if (line.startsWith('>')) {
      closeList();
      if (!inBlockquote) {
        outputLines.push('<blockquote class="md-blockquote">');
        inBlockquote = true;
      }
      outputLines.push(`<p>${parseInline(line.replace(/^>\s?/, ''))}</p>`);
      i++;
      continue;
    } else {
      closeBlockquote();
    }

    // 无序列表 - / * / + / ◦ / • / ○ / ● / ▪ / ▫
    const ulMatch = line.match(/^[-*+◦•○●▪▫]\s+(.+)$/);
    if (ulMatch) {
      if (inList !== 'ul') {
        closeList();
        outputLines.push('<ul class="md-ul">');
        inList = 'ul';
      }
      outputLines.push(`<li>${parseInline(ulMatch[1])}</li>`);
      i++;
      continue;
    }

    // 有序列表 1. 2. 1) 2)
    const olMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (olMatch) {
      if (inList !== 'ol') {
        closeList();
        outputLines.push('<ol class="md-ol">');
        inList = 'ol';
      }
      outputLines.push(`<li>${parseInline(olMatch[2])}</li>`);
      i++;
      continue;
    }

    // 空行
    if (!line.trim()) {
      closeList();
      closeBlockquote();
      i++;
      continue;
    }

    closeList();

    // 普通段落
    outputLines.push(`<p class="md-p">${parseInline(line)}</p>`);
    i++;
  }

  closeList();
  closeBlockquote();

  let htmlResult = outputLines.join('\n');

  // 7. 递归还原所有 Token
  tokenMap.forEach((tokenHtml, tokenKey) => {
    htmlResult = htmlResult.split(tokenKey).join(tokenHtml);
  });

  return htmlResult;
}

function parseInline(text: string): string {
  let res = text;
  // 加粗 **text**
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // 删除线 ~~text~~
  res = res.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return res;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
