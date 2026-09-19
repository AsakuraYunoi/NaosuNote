import type { ProblemInput } from '../types/problem';

/**
 * 清洗 HTML，移除 SVG 标签和所有 HTML 标签，仅保留纯题干文字
 */
export function extractCleanStemText(html: string): string {
  if (!html || typeof html !== 'string') return '';
  // 1. 移除 SVG 区域
  const withoutSvg = html.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  // 2. 移除所有 HTML 标签
  const textOnly = withoutSvg.replace(/<\/?[^>]+(>|$)/g, ' ');
  // 3. 压缩连续空白与换行
  return textOnly.replace(/\s+/g, ' ').trim();
}

/**
 * 解析用户输入的 HTML 字符串，提取一道或多道标准错题
 */
export function parseProblemHtml(rawText: string): ProblemInput[] {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return [];
  }

  const problems: ProblemInput[] = [];

  if (typeof document === 'undefined') {
    return problems;
  }

  const container = document.createElement('div');
  container.innerHTML = rawText;

  const elements = container.querySelectorAll('.naosu-problem');

  if (elements.length > 0) {
    elements.forEach((el) => {
      const subject = el.getAttribute('subject') || '数学';
      let type = el.getAttribute('type')?.trim() || '';
      if (!type) {
        if (el.querySelector('.blank')) {
          type = '填空';
        } else if (el.querySelector('.options')) {
          type = '单选';
        } else {
          type = '简答';
        }
      }
      const date = el.getAttribute('date') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const summary = el.getAttribute('summary') || '错题记录';
      const uuid = el.getAttribute('uuid') || '';

      const outerHtml = el.outerHTML;
      const stem_clean_text = extractCleanStemText(outerHtml);

      problems.push({
        uuid: uuid || undefined,
        subject,
        type,
        date,
        summary,
        raw_html: outerHtml,
        stem_clean_text,
        tags: [],
      });
    });
  } else {
    // 容错：如果用户粘贴的代码没有包裹外层 naosu-problem，但有内容
    const trimmed = rawText.trim();
    if (trimmed.length > 0) {
      const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const clean = extractCleanStemText(trimmed);
      let inferredType = '简答';
      if (trimmed.includes('class="blank') || trimmed.includes("class='blank'")) {
        inferredType = '填空';
      } else if (trimmed.includes('class="options') || trimmed.includes("class='options'")) {
        inferredType = '单选';
      }
      const wrapped = `<div class="naosu-problem" subject="数学" type="${inferredType}" date="${now}" summary="${clean.slice(0, 20)}">\n  <div class="problem-body">\n    ${trimmed}\n  </div>\n</div>`;
      problems.push({
        subject: '数学',
        type: inferredType,
        date: now,
        summary: clean.slice(0, 20) || '导入错题',
        raw_html: wrapped,
        stem_clean_text: clean,
        tags: [],
      });
    }
  }

  return problems;
}
