import { renderLatexInHtml } from './katexRender';

/**
 * 试卷排版智能预处理引擎 (Smart Exam Typesetting Engine)
 * 1. 自动图表混排检测：
 *    - 表格 + SVG 矢量配图 -> 自动左右并排 (.exam-side-table-img)
 *    - 选项 + SVG 矢量配图 -> 自动左右并排 (.exam-side-options-img)
 * 2. 选项自适应分列：
 *    - 选项文字极短（<=12字）：自动 4 列整齐横排
 *    - 选项文字适中（<=26字）：自动 2 列两两对称横排
 *    - 选项文字较长（>26字）：自动 1 列纵向排布
 * 3. 自动渲染 KaTeX 高清数学/物理/化学公式
 */
export function formatProblemForExam(rawHtml: string, index?: number): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let html = rawHtml;

  // 0. 移除可能存在的旧版属性栏和虚线索引条，确保无冗余标签
  html = html.replace(/<div\s+class=["']problem-index-bar["'][\s\S]*?<\/div>/gi, '');

  // 1. 一题多图横向排布：检测连续相邻的 <div class="img">，合并为横向排列容器 (.exam-images-row)
  // 不同类型的元素（如表格与图片、选项与图片）严格独立分行显示
  html = html.replace(/((?:<div\s+class=["']img["'][^>]*>[\s\S]*?<\/div>\s*){2,})/gi, (match) => {
    return `<div class="exam-images-row">${match.trim()}</div>`;
  });

  // 3. 智能分析选项长度并分配分列网格 class（严格限定有且仅有 2-col 与 1-col 两种展示方式）
  html = formatProblemOptions(html);

  // 4. 原子防切断算法 (Atomic Anti-Break Engine)
  // 防止行内物理量与数值单位被换行切断，例如：“……速度 $v$（换行）= 3 m/s……”
  html = wrapAtomicMathPhrases(html);

  // 5. 若传入题号，将题号注入题干开头或前置引导中（保证字号完全匹配题干正文，且去除所有属性与虚线）
  if (typeof index === 'number') {
    const indexHtml = `<span class="index-num">${index}. </span>`;
    const bodyMatch = html.match(/(<div\s+class=["']problem-body["'][^>]*>)([\s\S]*)/i);
    if (bodyMatch) {
      const prefix = bodyMatch[1];
      const rest = bodyMatch[2];
      // 检查 .problem-body 的首个子元素是否为图片、多图横排行、并排行或三线表
      const firstBlockIsMedia = /^\s*(<div\s+class=["'](?:img|exam-images-row|exam-row-group)["']|<table)/i.test(rest);
      if (firstBlockIsMedia) {
        html = html.replace(prefix, `${prefix}<div class="problem-lead-index">${indexHtml}</div>`);
      } else {
        // 首个子元素为文本容器（如 <div>、<p>），将题号插入首个标签内部起始位置
        const firstTagMatch = rest.match(/^(\s*<[a-z0-9]+[^>]*>)/i);
        if (firstTagMatch) {
          const insertPos = html.indexOf(prefix) + prefix.length + firstTagMatch[0].length;
          html = html.slice(0, insertPos) + indexHtml + html.slice(insertPos);
        } else {
          html = html.replace(prefix, `${prefix}${indexHtml}`);
        }
      }
    } else {
      const firstTagMatch = html.match(/^(\s*<[a-z0-9]+[^>]*>)/i);
      if (firstTagMatch) {
        html = html.slice(0, firstTagMatch[0].length) + indexHtml + html.slice(firstTagMatch[0].length);
      } else {
        html = indexHtml + html;
      }
    }
  }

  // 6. 渲染 LaTeX 公式
  return renderLatexInHtml(html);
}

/**
 * 保护小问标号与紧随文本绑定，避免标号孤悬在行尾
 */
function wrapAtomicMathPhrases(text: string): string {
  // 小问标号与紧接着的文本绑定，避免标号孤悬在行尾
  return text.replace(/(<span[^>]*class=["']sub-index["'][^>]*>\s*\([1-9一二三四]\)\s*<\/span>)/gi, (m) => {
    return `<span class="exam-atomic-phrase sub-index-atomic">${m}</span>`;
  });
}

/**
 * 精确估算选项内容的视觉等效长度（以中文字符宽度为 1 个单位）
 * - 中文字符 (CJK): 1.0 单位
 * - 半角英数与常见标点: 0.55 单位
 * - LaTeX 分式 \frac{a}{b} / \dfrac{a}{b}: 水平宽度取 max(len(a), len(b))
 * - LaTeX 根式 \sqrt{x}: len(x) + 0.8
 * - LaTeX 宏命令与修饰符: 按视觉呈现宽度折算
 */
export function estimateOptionVisualLength(rawText: string): number {
  if (!rawText) return 0;

  // 1. 去除所有 HTML 标签
  let s = rawText.replace(/<[^>]+>/g, '').trim();

  // 2. 去除开头的 A. B. C. D. 或 a. b. c. d. 标号，统一按标准标号额外计入 2.0 单位（约 'A. '）
  s = s.replace(/^[A-Da-d][\.、\s]+/, '').trim();

  // 3. 处理 LaTeX 分式：\frac{num}{den} 或 \dfrac{num}{den}
  s = s.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
    const numClean = num.replace(/\\[a-zA-Z]+/g, 'X').replace(/[\{\}\$_\^\\]/g, '');
    const denClean = den.replace(/\\[a-zA-Z]+/g, 'X').replace(/[\{\}\$_\^\\]/g, '');
    return 'X'.repeat(Math.max(numClean.length, denClean.length, 1));
  });

  // 4. 处理 \sqrt{...}
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, (_, inner) => 'X' + inner);

  // 5. 处理 \text{...} 或 \mathrm{...}
  s = s.replace(/\\(text|mathrm|mathbf|mathit)\{([^{}]+)\}/g, '$2');

  // 6. 去除其他 LaTeX 宏命令名字（如 \sin, \cos, \log, \ln, \alpha, \pi 等替换为 1 个字符）
  s = s.replace(/\\[a-zA-Z]+/g, 'X');

  // 7. 去除 LaTeX 语法控制符号 ($、{、}、_、^、\)
  s = s.replace(/[\{\}\$_\^\\]/g, '');

  // 8. 标号自身的固定视觉长度（"A. " 约 2.0 单位）
  let totalLength = 2.0;

  // 9. 遍历统计 CJK 字符与半角字符
  for (const ch of s) {
    if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch)) {
      totalLength += 1.0; // 全角 / 中文字符
    } else if (/\s/.test(ch)) {
      totalLength += 0.3; // 普通空格
    } else {
      totalLength += 0.55; // 半角英数与半角符号
    }
  }

  return totalLength;
}

/**
 * 格式化与重构选择题选项容器 (.options)
 * 智能排版规范：
 * 1. 四行连排 (options-4-col)：若 四个选项长度之和 + 最小空格间距*4 <= 视口/纸张宽度
 * 2. 双双排法 (options-2-col)：若不满足四行连排，且每个选项都能在半行内排下 (<= 20 单位)
 * 3. 单列纵向 (options-1-col)：若双双排法中有一个选项不能排在一行 (> 20 单位)，则切换为单列
 */
export function formatProblemOptions(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return html.replace(
    /<div\s+([^>]*\bclass=["'][^"']*\boptions\b[^"']*["'][^>]*)>([\s\S]*?)<\/div>/gi,
    (fullMatch, rawAttrs, inner) => {
      // 提取所有 <span> 选项
      const spanMatches = [...inner.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)];

      // 仅当用户在画布或代码中显式指定了 data-column-layout / data-layout 时才视为手动锁定覆盖
      const manualMatch = rawAttrs.match(/data-(?:column-)?layout=["'](1-col|2-col|4-col)["']/i);
      let colClass = manualMatch ? `options-${manualMatch[1]}` : '';

      if (!colClass && spanMatches.length > 0) {
        const lengths = spanMatches.map((m) => estimateOptionVisualLength(m[1] || ''));
        const sumLen = lengths.reduce((a, b) => a + b, 0);
        const maxLen = Math.max(...lengths, 0);

        // 视口与纸张可用行宽（以全角汉字字宽为 1 单位）：标准排版下约 42 ~ 46 单位 (约 640px - 700px)
        const paperLineWidth = 44;
        // 最小空格间距 * 4：每个选项间保留约 3 个汉字宽度间距 (约 45px，约 4~5 个半角空格)
        const minSpace4 = 12;

        if (spanMatches.length === 4) {
          if (sumLen + minSpace4 <= paperLineWidth) {
            // 四个选项长度之和 + 最小空格间距*4 <= 视口宽度/纸张宽度 -> 四行连排
            colClass = 'options-4-col';
          } else if (maxLen > 20) {
            // 双双排法中若有一个选项不能排在一行（半行宽约 20 单位） -> 切换为单列
            colClass = 'options-1-col';
          } else {
            // 否则 -> 采用双双排法 (A B / C D)
            colClass = 'options-2-col';
          }
        } else if (spanMatches.length === 2) {
          colClass = maxLen > 20 ? 'options-1-col' : 'options-2-col';
        } else {
          colClass = maxLen > 20 ? 'options-1-col' : 'options-2-col';
        }
      }

      if (!colClass) colClass = 'options-2-col';

      // 标准化内部每个 <span> 中的选项标号格式（如 "A. "、"B. "，确保标号与文本间距均匀优雅）
      const formattedInner = inner.replace(
        /<span([^>]*)>([\s\S]*?)<\/span>/gi,
        (_: string, spanAttrs: string, spanContent: string) => {
          let normalized = spanContent.trim();
          normalized = normalized.replace(/^([A-Da-d])([\.、\s])\s*/, '$1. ');
          return `<span${spanAttrs}>${normalized}</span>`;
        }
      );

      // 清理原有 class 中可能遗留的旧版分列网格标记，统一附加标准类名
      let cleanedAttrs = rawAttrs
        .replace(/\boptions-4-col\b/gi, '')
        .replace(/\boptions-2-col\b/gi, '')
        .replace(/\boptions-1-col\b/gi, '')
        .replace(/\boptions-grid\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // 将 class 属性替换为最新的 options options-grid ${colClass}
      cleanedAttrs = cleanedAttrs.replace(
        /\bclass=["']([^"']*)["']/i,
        (_: string, cls: string) => `class="${cls.trim()} options-grid ${colClass}"`
      );

      return `<div ${cleanedAttrs}>${formattedInner}</div>`;
    }
  );
}

