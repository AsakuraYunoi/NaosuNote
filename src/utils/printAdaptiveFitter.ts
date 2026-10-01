/**
 * 试卷打印版心宽度自适应等比缩放计算器 (Print Adaptive Fitter)
 * 确保题目编辑时固化在同一行的多个元素（如图片+表格、多图并排）
 * 在不同纸张（A4/B5）和不同页边距下自动等比例适应版心宽度，绝不爆页穿模
 */

export interface PaperMetrics {
  paperWidthMm: number; // A4: 210, B5: 176
  paddingMm: number; // 紧凑: 12, 标准: 15, 宽松: 18
  dpiScale?: number; // 默认 3.7795 (96 DPI: 1mm = 3.7795px)
}

export function getAvailableContentWidthPx(metrics: PaperMetrics): number {
  const dpi = metrics.dpiScale || 3.7795;
  const availMm = Math.max(80, metrics.paperWidthMm - 2 * metrics.paddingMm);
  return Math.round(availMm * dpi);
}

/**
 * 遍历已挂载的页面或打印容器中的 .exam-row-group，计算并应用等比自适应收缩
 */
export function applyAdaptiveRowScaling(
  rootElement: HTMLElement,
  availableWidthPx: number
): void {
  if (!rootElement) return;

  const rowGroups = rootElement.querySelectorAll<HTMLElement>('.exam-row-group, .exam-images-row');
  rowGroups.forEach((row) => {
    // 找出所有直接子项中的图片和表格
    const childBoxes = Array.from(row.children) as HTMLElement[];
    if (childBoxes.length <= 1) return;

    let nominalTotalWidth = 0;
    const gap = 12; // 项间隙 px

    childBoxes.forEach((child) => {
      // 检查子元素中的 SVG 或 Table
      const svg = child.querySelector('svg');
      let w = 0;
      if (svg) {
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.trim().split(/\s+/).map(Number);
          if (parts[2]) w = parts[2];
        }
      }
      if (!w) {
        w = child.offsetWidth || 300;
      }
      nominalTotalWidth += w;
    });

    nominalTotalWidth += (childBoxes.length - 1) * gap;

    // 若名义总宽超出版心，进行整体等比压缩
    if (nominalTotalWidth > availableWidthPx) {
      const scale = availableWidthPx / nominalTotalWidth;
      row.style.display = 'flex';
      row.style.flexWrap = 'nowrap';
      row.style.gap = `${Math.round(gap * scale)}px`;
      row.style.justifyContent = 'space-between';
      row.style.width = '100%';

      childBoxes.forEach((child) => {
        child.style.flex = '1 1 0%';
        child.style.maxWidth = '100%';
        const svg = child.querySelector('svg');
        if (svg) {
          svg.style.width = '100%';
          svg.style.height = 'auto';
        }
      });
    }
  });
}
