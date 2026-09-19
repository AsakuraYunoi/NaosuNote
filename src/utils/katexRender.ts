import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * 将含 LaTeX 标记 ($...$ 和 $$...$$) 的 HTML 字符串渲染为带有 KaTeX 结果的 HTML
 */
export function renderLatexInHtml(html: string): string {
  if (!html) return '';

  let result = html;

  // 1. 替换块级公式 $$...$$
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch (e) {
      console.warn('KaTeX display error:', e);
      return `$$${tex}$$`;
    }
  });

  // 2. 替换行内公式 $...$
  result = result.replace(/\$([^\$\n\r]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch (e) {
      console.warn('KaTeX inline error:', e);
      return `$${tex}$`;
    }
  });

  return result;
}
