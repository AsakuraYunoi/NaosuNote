import { renderLatexInHtml } from './katexRender';

export const ARTBOARD_INNER_WIDTH = 592;

/**
 * 规范文档流：将顶层散装文本节点与内联节点包裹成标准 <p> 段落
 */
export function normalizeDocumentTree(root: HTMLElement): void {
  const blockTags = new Set([
    'P', 'DIV', 'TABLE', 'UL', 'OL', 'HR', 'SECTION', 'HEADER',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
  ]);
  const nodes = Array.from(root.childNodes);
  let currentGroup: Node[] = [];

  function flushGroup() {
    if (currentGroup.length === 0) return;
    const textContent = currentGroup.map((n) => n.textContent || '').join('').trim();
    if (textContent.length > 0) {
      const p = document.createElement('p');
      p.className = 'stem-paragraph';
      const first = currentGroup[0];
      root.insertBefore(p, first);
      currentGroup.forEach((n) => p.appendChild(n));
    } else {
      currentGroup.forEach((n) => n.parentNode?.removeChild(n));
    }
    currentGroup = [];
  }

  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE && blockTags.has((node as HTMLElement).tagName)) {
      flushGroup();
    } else {
      currentGroup.push(node);
    }
  }
  flushGroup();
}

/**
 * 递归/层级向上找到该多媒体的顶层独立块级节点（例如 .img, .table-shell, 或并排行容器内的直接子项）
 */
export function getTopMediaElement(el: HTMLElement | null): HTMLElement | null {
  if (!el || el.closest('.katex') || el.closest('.katex-html')) return null;

  // 1. 若处于并排容器内部，返回直接挂在 .exam-images-row 下的那个子元素
  const row = el.closest('.exam-images-row') as HTMLElement | null;
  if (row && el !== row) {
    let cur: HTMLElement = el;
    while (cur.parentElement && cur.parentElement !== row) {
      cur = cur.parentElement;
    }
    return cur;
  }

  // 2. 若在 .img 容器内，返回外层 .img
  const outerImg = el.closest('.img') as HTMLElement | null;
  if (outerImg) return outerImg;

  // 3. 若为表格实体外壳或独立 table
  const shell = el.closest('.canvas-media-shell') as HTMLElement | null;
  if (shell) return shell;

  const table = el.closest('table') as HTMLElement | null;
  if (table) return table;

  return el;
}

/**
 * 在兄弟节点中寻找下一个/上一个多媒体块，能智能跳过空白/空段落
 */
export function findAdjacentMedia(
  currentBlock: HTMLElement,
  direction: 'prev' | 'next'
): HTMLElement | null {
  let sibling = direction === 'prev'
    ? currentBlock.previousElementSibling
    : currentBlock.nextElementSibling;

  while (sibling) {
    const el = sibling as HTMLElement;
    // 检查是否为多媒体或并排容器
    if (
      el.classList.contains('img') ||
      el.classList.contains('canvas-media-shell') ||
      el.tagName.toLowerCase() === 'table' ||
      el.classList.contains('exam-images-row') ||
      el.querySelector('.img, table, svg, .canvas-media-shell')
    ) {
      return getTopMediaElement(el) || el;
    }

    // 如果包含非空文字内容，说明遇到了真实题干段落，停止搜寻
    const text = el.textContent?.trim() || '';
    if (text.length > 0) {
      break;
    }

    sibling = direction === 'prev'
      ? sibling.previousElementSibling
      : sibling.nextElementSibling;
  }

  return null;
}

/**
 * 获取文档内所有独立的多媒体顶层块（自动去重且排除交互覆盖层）
 */
export function getAllMediaBlocks(docRoot: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  const candidates = docRoot.querySelectorAll<HTMLElement>('.img, table, .canvas-media-shell, .exam-images-row');
  candidates.forEach((cand) => {
    // 严防 UI 交互层或 KaTeX 内部渗入
    if (cand.closest('.shell-interactive-overlay') || cand.closest('.katex') || cand.closest('.katex-html')) return;

    const top = getTopMediaElement(cand);
    if (top && !seen.has(top) && top !== docRoot) {
      seen.add(top);
      blocks.push(top);
    }
  });

  return blocks;
}

/**
 * 为所有配图与表格装配紧凑实体外壳 (.canvas-media-shell)
 * 纯逻辑函数：严防侵入 UI 交互层或 KaTeX 数学公式内部矢量节点
 */
export function setupMediaShells(docRoot: HTMLElement, artboardInnerWidth: number = ARTBOARD_INNER_WIDTH): void {
  // 1. 如果有裸露的 svg，包装入 .img（绝对排除覆盖层内部图标与 KaTeX 公式内部的矢量根号）
  const nakedSvgs = Array.from(docRoot.querySelectorAll('svg')).filter(
    (svg) => !svg.closest('.shell-interactive-overlay') && !svg.closest('.katex') && !svg.closest('.katex-html') && !svg.closest('.katex-mathml')
  );
  nakedSvgs.forEach((svg) => {
    if (!svg.closest('.img')) {
      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'img';
      svg.parentElement?.insertBefore(imgWrapper, svg);
      imgWrapper.appendChild(svg);
    }
  });

  // 2. 为每个 .img 内部的 svg 装配紧贴自身的 .canvas-media-shell
  const imgBlocks = Array.from(docRoot.querySelectorAll<HTMLElement>('.img')).filter(
    (img) => !img.closest('.shell-interactive-overlay') && !img.closest('.katex')
  );
  imgBlocks.forEach((img) => {
    img.setAttribute('contenteditable', 'false');
    img.style.userSelect = 'none';

    const svg = Array.from(img.querySelectorAll('svg')).find(
      (s) => !s.closest('.shell-interactive-overlay') && !s.closest('.katex')
    );
    if (svg) {
      if (!svg.getAttribute('viewBox')) {
        const w = svg.getAttribute('width') || '400';
        const h = svg.getAttribute('height') || '200';
        svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
      }

      let shell = svg.closest('.canvas-media-shell') as HTMLElement | null;
      if (!shell || shell.parentElement !== img) {
        shell = document.createElement('div');
        shell.className = 'canvas-media-shell image-shell';
        shell.dataset.mediaType = 'image';

        const svgStyleW = svg.style.width;
        const attrW = svg.getAttribute('width');
        const viewBox = svg.viewBox?.baseVal;

        if (svgStyleW && svgStyleW.endsWith('px')) {
          shell.style.width = svgStyleW;
        } else if (attrW && parseFloat(attrW) > 0) {
          shell.style.width = `${Math.min(artboardInnerWidth, Math.max(160, parseFloat(attrW)))}px`;
        } else if (viewBox && viewBox.width > 0) {
          const defaultW = Math.min(500, Math.max(240, Math.round(viewBox.width)));
          shell.style.width = `${defaultW}px`;
        } else {
          shell.style.width = '420px';
        }

        svg.style.width = '100%';
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
        svg.style.display = 'block';

        svg.parentElement?.insertBefore(shell, svg);
        shell.appendChild(svg);
      }
    }
  });

  // 3. 为每个 table 装配 .canvas-media-shell
  const tables = Array.from(docRoot.querySelectorAll<HTMLElement>('table')).filter(
    (table) => !table.closest('.shell-interactive-overlay')
  );
  tables.forEach((table) => {
    table.setAttribute('contenteditable', 'false');
    table.style.userSelect = 'none';

    let shell = table.closest('.canvas-media-shell') as HTMLElement | null;
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'canvas-media-shell table-shell';
      shell.dataset.mediaType = 'table';
      if (table.style.width) {
        shell.style.width = table.style.width;
        table.style.width = '100%';
      } else {
        shell.style.width = '88%';
      }
      table.parentElement?.insertBefore(shell, table);
      shell.appendChild(table);
    }
  });
}

/**
 * 切换选中图表的同行并排 (Exam Images Row Side-by-Side Flex Layout)
 * 返回是否成功执行
 */
export function toggleSideBySideLayout(selectedShell: HTMLElement, docRoot: HTMLElement): boolean {
  const currentBlock = getTopMediaElement(selectedShell);
  if (!currentBlock) return false;

  const existingRow = currentBlock.closest('.exam-images-row') as HTMLElement | null;

  if (existingRow) {
    // 1. 拆分为独立单行：将元素拆出
    const parent = existingRow.parentElement;
    if (parent) {
      const items = Array.from(existingRow.children) as HTMLElement[];
      items.forEach((item) => {
        parent.insertBefore(item, existingRow);
      });
      existingRow.remove();
    }
    return true;
  } else {
    // 2. 合并为同行并排：寻找相邻图表或表格
    let siblingMedia: HTMLElement | null = null;

    const nextMedia = findAdjacentMedia(currentBlock, 'next');
    const prevMedia = findAdjacentMedia(currentBlock, 'prev');

    if (nextMedia) {
      siblingMedia = nextMedia;
    } else if (prevMedia) {
      siblingMedia = prevMedia;
    } else {
      // 找不到相邻的，全局查找未处于并排行内的其他媒体
      const allMedias = getAllMediaBlocks(docRoot).filter(
        (el) => el !== currentBlock && !currentBlock.contains(el) && !el.closest('.exam-images-row')
      );
      if (allMedias.length > 0) {
        siblingMedia = allMedias[0];
      }
    }

    if (siblingMedia) {
      if (siblingMedia.classList.contains('exam-images-row')) {
        // 直接加入已有的并排容器
        siblingMedia.appendChild(currentBlock);
      } else {
        // 创建全新的并排容器
        const row = document.createElement('div');
        row.className = 'exam-images-row';

        const parent = currentBlock.parentElement;
        if (parent) {
          parent.insertBefore(row, currentBlock);
          if (siblingMedia === prevMedia) {
            row.appendChild(siblingMedia);
            row.appendChild(currentBlock);
          } else {
            row.appendChild(currentBlock);
            row.appendChild(siblingMedia);
          }
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * 删除选中媒体块，并智能清理空的并排容器
 */
export function deleteMediaBlock(selectedShell: HTMLElement): HTMLElement | null {
  const blockToDelete = getTopMediaElement(selectedShell) || selectedShell;
  const row = blockToDelete.closest('.exam-images-row') as HTMLElement | null;

  blockToDelete.remove();

  // 如果所在同行并排容器只剩 1 个子元素，自动解包该容器
  if (row) {
    if (row.children.length <= 1) {
      const parent = row.parentElement;
      if (parent) {
        const remaining = row.firstElementChild;
        if (remaining) {
          parent.insertBefore(remaining, row);
        }
        row.remove();
        return remaining as HTMLElement;
      }
    }
  }

  return null;
}

/**
 * 设置多媒体对齐方式
 */
export function setMediaBlockAlignment(
  selectedShell: HTMLElement,
  align: 'left' | 'center' | 'right'
): void {
  const wrapper = selectedShell.closest('.img') as HTMLElement | null;

  if (wrapper) {
    wrapper.style.display = 'flex';
    if (align === 'left') {
      wrapper.style.justifyContent = 'flex-start';
      wrapper.style.textAlign = 'left';
    } else if (align === 'center') {
      wrapper.style.justifyContent = 'center';
      wrapper.style.textAlign = 'center';
    } else if (align === 'right') {
      wrapper.style.justifyContent = 'flex-end';
      wrapper.style.textAlign = 'right';
    }
  } else {
    selectedShell.style.display = 'block';
    if (align === 'left') {
      selectedShell.style.marginLeft = '0';
      selectedShell.style.marginRight = 'auto';
    } else if (align === 'center') {
      selectedShell.style.marginLeft = 'auto';
      selectedShell.style.marginRight = 'auto';
    } else if (align === 'right') {
      selectedShell.style.marginLeft = 'auto';
      selectedShell.style.marginRight = '0';
    }
  }
}

/**
 * 序列化当前 DOM 节点为标准、纯净的 raw_html
 */
export function cleanAndSerializeHtml(docRoot: HTMLElement, fallbackHtml: string = ''): string {
  if (!docRoot) return fallbackHtml;

  const clone = docRoot.cloneNode(true) as HTMLElement;

  // 1. 移除可能残留的 Teleport 覆盖层
  clone.querySelectorAll('.shell-interactive-overlay').forEach((el) => el.remove());

  // 2. 移除 KaTeX 渲染节点，还原干净 $latex$ 源码
  const katexNodes = clone.querySelectorAll('.katex');
  katexNodes.forEach((node) => {
    const annot = node.querySelector('annotation');
    if (annot) {
      const latex = annot.textContent || '';
      const textNode = document.createTextNode(`$${latex}$`);
      node.replaceWith(textNode);
    }
  });

  // 3. 解除临时交互外壳 (.canvas-media-shell)，保持标准规范 HTML 存储
  const shells = clone.querySelectorAll<HTMLElement>('.canvas-media-shell');
  shells.forEach((shell) => {
    shell.classList.remove('is-selected');
    const widthStyle = shell.style.width;

    const svg = shell.querySelector('svg');
    const table = shell.querySelector('table');

    if (svg) {
      if (widthStyle) {
        svg.style.width = widthStyle;
        svg.style.height = 'auto';
      }
      shell.parentElement?.insertBefore(svg, shell);
      shell.remove();
    } else if (table) {
      if (widthStyle) {
        table.style.width = widthStyle;
      }
      shell.parentElement?.insertBefore(table, shell);
      shell.remove();
    }
  });

  // 4. 清理空或孤儿 .exam-images-row 并排容器
  clone.querySelectorAll('.exam-images-row').forEach((row) => {
    if (row.children.length === 0) {
      row.remove();
    } else if (row.children.length === 1) {
      const child = row.firstElementChild;
      if (child) {
        row.parentElement?.insertBefore(child, row);
      }
      row.remove();
    }
  });

  // 5. 清理编辑态遗留属性
  clone.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable');
  });
  clone.querySelectorAll('*').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.removeProperty('user-select');
      el.style.removeProperty('-webkit-user-select');
      el.style.removeProperty('cursor');
    }
  });

  return clone.innerHTML.trim();
}
