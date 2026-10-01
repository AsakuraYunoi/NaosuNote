import type {
  Problem,
  ProblemCanvasDoc,
  CanvasBlock,
  LeadTextBlock,
  SvgImgBlock,
  TableBlock,
  OptionsBlock,
  SubItemBlock,
  RowGroupBlock,
  OptionItem,
} from '../types/problem';

let blockIdCounter = 0;
export function generateBlockId(prefix: string = 'blk'): string {
  blockIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${blockIdCounter}`;
}

/**
 * 将原始 raw_html 解析为结构化画布文档模型 ProblemCanvasDoc
 */
export function parseRawHtmlToCanvasDoc(problem: Problem): ProblemCanvasDoc {
  const doc: ProblemCanvasDoc = {
    uuid: problem.uuid,
    subject: problem.subject || '数学',
    problemType: problem.type || '简答',
    date: problem.date || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    summary: problem.summary || '',
    blocks: [],
  };

  const rawHtml = problem.raw_html || '';
  if (!rawHtml.trim()) {
    return doc;
  }

  // 利用 DOMParser 解析 HTML
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(rawHtml, 'text/html');

  // 1. 尝试从 <div class="naosu-problem"> 提取根属性
  const rootProblemEl = htmlDoc.querySelector('.naosu-problem');
  if (rootProblemEl) {
    if (rootProblemEl.getAttribute('subject')) {
      doc.subject = rootProblemEl.getAttribute('subject')!;
    }
    if (rootProblemEl.getAttribute('type')) {
      doc.problemType = rootProblemEl.getAttribute('type')!;
    }
    if (rootProblemEl.getAttribute('date')) {
      doc.date = rootProblemEl.getAttribute('date')!;
    }
    if (rootProblemEl.getAttribute('summary')) {
      doc.summary = rootProblemEl.getAttribute('summary')!;
    }
  }

  // 2. 找到题干容器 .problem-body，若无则使用 rootProblemEl 或 body
  const bodyEl = htmlDoc.querySelector('.problem-body') || rootProblemEl || htmlDoc.body;
  const blocks: CanvasBlock[] = [];

  // 辅助解析单张图片
  function parseImgElement(el: HTMLElement): SvgImgBlock {
    const svgEl = el.querySelector('svg');
    const svgContent = svgEl ? svgEl.outerHTML : el.innerHTML.trim();
    let nominalWidth: number | undefined;
    let nominalHeight: number | undefined;
    let aspectRatio: number | undefined;

    if (svgEl) {
      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/\s+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          aspectRatio = parts[2] / parts[3];
          nominalWidth = parts[2];
          nominalHeight = parts[3];
        }
      }
    }
    return {
      id: generateBlockId('img'),
      type: 'svg_img',
      svgContent,
      nominalWidth,
      nominalHeight,
      aspectRatio,
    };
  }

  // 辅助解析表格
  function parseTableElement(el: HTMLElement): TableBlock {
    const tableEl = el.tagName.toLowerCase() === 'table' ? el : el.querySelector('table');
    const tableHtml = tableEl ? tableEl.outerHTML : el.innerHTML.trim();
    return {
      id: generateBlockId('tbl'),
      type: 'table',
      tableHtml,
    };
  }

  // 辅助解析选项
  function parseOptionsElement(el: HTMLElement): OptionsBlock {
    const spanList = el.querySelectorAll('span');
    const options: OptionItem[] = [];
    spanList.forEach((sp, idx) => {
      const text = sp.innerHTML.trim();
      const match = text.match(/^([A-D])[\.、\s]+([\s\S]*)$/);
      if (match) {
        options.push({ label: match[1], textHtml: match[2].trim() });
      } else {
        const label = String.fromCharCode(65 + idx);
        options.push({ label, textHtml: text });
      }
    });

    let columnLayout: 'auto' | '1-col' | '2-col' | '4-col' = 'auto';
    const manualLayout = el.getAttribute('data-column-layout') || el.getAttribute('data-layout');
    if (manualLayout === '1-col' || manualLayout === '2-col' || manualLayout === '4-col') {
      columnLayout = manualLayout as any;
    }

    return {
      id: generateBlockId('opt'),
      type: 'options',
      options,
      columnLayout,
    };
  }

  // 遍历子节点构建 Blocks
  const childNodes = Array.from(bodyEl.children) as HTMLElement[];
  for (const child of childNodes) {
    const tag = child.tagName.toLowerCase();
    const classList = child.classList;

    // A. 组合并排行容器 (Row Group / Multiple Images)
    if (classList.contains('exam-row-group') || classList.contains('exam-images-row')) {
      const groupChildren: (SvgImgBlock | TableBlock)[] = [];
      const subItems = Array.from(child.children) as HTMLElement[];
      for (const sub of subItems) {
        if (sub.classList.contains('img') || sub.querySelector('svg')) {
          groupChildren.push(parseImgElement(sub));
        } else if (sub.tagName.toLowerCase() === 'table' || sub.querySelector('table')) {
          groupChildren.push(parseTableElement(sub));
        }
      }
      if (groupChildren.length > 0) {
        blocks.push({
          id: generateBlockId('row'),
          type: 'row_group',
          children: groupChildren,
        });
      }
      continue;
    }

    // B. 单图块
    if (classList.contains('img') || (tag === 'div' && child.querySelector('svg') && !child.querySelector('p'))) {
      blocks.push(parseImgElement(child));
      continue;
    }

    // C. 表格块
    if (tag === 'table' || (tag === 'div' && child.querySelector('table'))) {
      blocks.push(parseTableElement(child));
      continue;
    }

    // D. 小问块 (SubItem)
    if (classList.contains('sub-item') || /^\s*\([1-9一二三四]\)/.test(child.textContent || '')) {
      const indexMatch = (child.textContent || '').match(/^\s*(\([1-9一二三四]\))/);
      const indexLabel = indexMatch ? indexMatch[1] : '(1)';
      let contentHtml = child.innerHTML.replace(/^\s*<span[^>]*class=["']sub-index["'][^>]*>[\s\S]*?<\/span>/i, '');
      contentHtml = contentHtml.replace(/^\s*\([1-9一二三四]\)\s*/, '').trim();

      const subBlocks: (SvgImgBlock | TableBlock | OptionsBlock)[] = [];
      // 检查小问内部是否有独立的图片或表格或选项
      const nestedImgs = child.querySelectorAll('.img, svg');
      nestedImgs.forEach((imgNode) => {
        const parentDiv = (imgNode.closest('.img') || imgNode) as HTMLElement;
        subBlocks.push(parseImgElement(parentDiv));
      });

      blocks.push({
        id: generateBlockId('sub'),
        type: 'sub_item',
        indexLabel,
        contentHtml,
        subBlocks: subBlocks.length > 0 ? subBlocks : undefined,
      });
      continue;
    }

    // E. 选项组块
    if (classList.contains('options')) {
      blocks.push(parseOptionsElement(child));
      continue;
    }

    // F. 普通文本与公式主述块
    const innerHtml = child.innerHTML.trim();
    if (innerHtml) {
      blocks.push({
        id: generateBlockId('txt'),
        type: 'lead_text',
        contentHtml: innerHtml,
      });
    }
  }

  // 3. 检查是否有独立的 .options 位于 .problem-body 之外（例如标准结构）
  const outerOptionsEl = htmlDoc.querySelector('.naosu-problem > .options');
  if (outerOptionsEl) {
    blocks.push(parseOptionsElement(outerOptionsEl as HTMLElement));
  }

  // 如果没有解析出任何 block，但有纯文本或未能分类的内容，保底放入一个文本块
  if (blocks.length === 0 && rawHtml.trim()) {
    blocks.push({
      id: generateBlockId('txt'),
      type: 'lead_text',
      contentHtml: rawHtml.trim(),
    });
  }

  doc.blocks = blocks;
  return doc;
}

/**
 * 将 ProblemCanvasDoc 序列化为规范的 raw_html 字符串
 */
export function serializeCanvasDocToRawHtml(doc: ProblemCanvasDoc): string {
  const parts: string[] = [];

  // 注释标头：<!--学科题型日期_摘要-->
  parts.push(`<!--${doc.subject}${doc.problemType}${doc.date}_${doc.summary}-->`);

  // 主属性容器
  parts.push(
    `<div class="naosu-problem" subject="${doc.subject}" type="${doc.problemType}" date="${doc.date}" summary="${doc.summary}">`
  );
  parts.push(`  <div class="problem-body">`);

  let standaloneOptionsHtml: string | null = null;

  for (const block of doc.blocks) {
    switch (block.type) {
      case 'lead_text': {
        parts.push(`    <p class="problem-lead">${block.contentHtml}</p>`);
        break;
      }
      case 'svg_img': {
        const styleAttr = block.nominalWidth ? ` style="max-width: ${block.nominalWidth}px;"` : '';
        parts.push(`    <div class="img"${styleAttr}>${block.svgContent}</div>`);
        break;
      }
      case 'table': {
        const styleAttr = block.nominalWidth ? ` style="max-width: ${block.nominalWidth}px;"` : '';
        parts.push(`    <div class="table-wrap"${styleAttr}>${block.tableHtml}</div>`);
        break;
      }
      case 'row_group': {
        parts.push(`    <div class="exam-row-group" data-layout="side-by-side">`);
        for (const child of block.children) {
          if (child.type === 'svg_img') {
            const styleAttr = child.nominalWidth ? ` style="max-width: ${child.nominalWidth}px;"` : '';
            parts.push(`      <div class="img"${styleAttr}>${child.svgContent}</div>`);
          } else if (child.type === 'table') {
            const styleAttr = child.nominalWidth ? ` style="max-width: ${child.nominalWidth}px;"` : '';
            parts.push(`      <div class="table-wrap"${styleAttr}>${child.tableHtml}</div>`);
          }
        }
        parts.push(`    </div>`);
        break;
      }
      case 'sub_item': {
        parts.push(`    <div class="sub-item" data-index="${block.indexLabel}">`);
        parts.push(`      <span class="sub-index">${block.indexLabel}</span> ${block.contentHtml}`);
        if (block.subBlocks && block.subBlocks.length > 0) {
          for (const sub of block.subBlocks) {
            if (sub.type === 'svg_img') {
              parts.push(`      <div class="img">${sub.svgContent}</div>`);
            } else if (sub.type === 'table') {
              parts.push(`      <div class="table-wrap">${sub.tableHtml}</div>`);
            } else if (sub.type === 'options') {
              const isManual = Boolean(sub.columnLayout && sub.columnLayout !== 'auto');
              const colClass = isManual && sub.columnLayout ? ` options-${sub.columnLayout.replace(/^options-/, '')}` : '';
              const manualAttr = isManual && sub.columnLayout ? ` data-column-layout="${sub.columnLayout}"` : '';
              parts.push(`      <div class="options${colClass}"${manualAttr}>`);
              for (const opt of sub.options) {
                parts.push(`        <span>${opt.label}. ${opt.textHtml}</span>`);
              }
              parts.push(`      </div>`);
            }
          }
        }
        parts.push(`    </div>`);
        break;
      }
      case 'options': {
        const isManual = Boolean(block.columnLayout && block.columnLayout !== 'auto');
        const colClass = isManual && block.columnLayout ? ` options-${block.columnLayout.replace(/^options-/, '')}` : '';
        const manualAttr = isManual && block.columnLayout ? ` data-column-layout="${block.columnLayout}"` : '';
        const optHtml = [
          `    <div class="options${colClass}"${manualAttr}>`,
          ...block.options.map((opt) => `      <span>${opt.label}. ${opt.textHtml}</span>`),
          `    </div>`,
        ].join('\n');
        standaloneOptionsHtml = optHtml;
        break;
      }
    }
  }

  parts.push(`  </div>`); // end .problem-body

  if (standaloneOptionsHtml) {
    parts.push(standaloneOptionsHtml);
  }

  parts.push(`</div>`); // end .naosu-problem

  return parts.join('\n');
}

/**
 * 从 ProblemCanvasDoc 中提取用于全文检索和去重比对的无格式纯文本
 */
export function extractCleanTextFromDoc(doc: ProblemCanvasDoc): string {
  const textPieces: string[] = [];

  for (const block of doc.blocks) {
    if (block.type === 'lead_text') {
      textPieces.push(stripHtmlTags(block.contentHtml));
    } else if (block.type === 'sub_item') {
      textPieces.push(`${block.indexLabel} ${stripHtmlTags(block.contentHtml)}`);
    } else if (block.type === 'options') {
      for (const opt of block.options) {
        textPieces.push(`${opt.label}. ${stripHtmlTags(opt.textHtml)}`);
      }
    }
  }

  return textPieces.join(' ').replace(/\s+/g, ' ').trim();
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, '').trim();
}
