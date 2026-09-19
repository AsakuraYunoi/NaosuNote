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

  // 3. 智能分析选项长度并分配分列网格 class
  html = html.replace(/<div\s+class=["']options["']\s*>([\s\S]*?)<\/div>/gi, (_, inner) => {
    const spanMatches = [...inner.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)];
    let colClass = 'options-4-col';
    if (spanMatches.length > 0) {
      const lengths = spanMatches.map((m) => (m[1] ? m[1].replace(/<[^>]+>/g, '').trim().length : 0));
      const maxLen = Math.max(...lengths, 0);
      if (maxLen > 26) {
        colClass = 'options-1-col';
      } else if (maxLen > 12) {
        colClass = 'options-2-col';
      } else {
        colClass = 'options-4-col';
      }
    }
    return `<div class="options options-grid ${colClass}">${inner}</div>`;
  });

  // 4. 若传入题号，将题号注入题干开头或前置引导中（保证字号完全匹配题干正文，且去除所有属性与虚线）
  if (typeof index === 'number') {
    const indexHtml = `<span class="index-num">${index}. </span>`;
    const bodyMatch = html.match(/(<div\s+class=["']problem-body["'][^>]*>)([\s\S]*)/i);
    if (bodyMatch) {
      const prefix = bodyMatch[1];
      const rest = bodyMatch[2];
      // 检查 .problem-body 的首个子元素是否为图片、多图横排行或三线表
      const firstBlockIsMedia = /^\s*(<div\s+class=["'](?:img|exam-images-row)["']|<table)/i.test(rest);
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

  // 5. 渲染 LaTeX 公式
  return renderLatexInHtml(html);
}
