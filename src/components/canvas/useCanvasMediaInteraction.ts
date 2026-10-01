import { ref, computed, type Ref, onUnmounted } from 'vue';
import { getTopMediaElement } from '../../utils/mediaLayoutEngine';

export interface DropGuide {
  type: 'vertical' | 'horizontal';
  style: Record<string, string>;
  badge: string;
}

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SnapTarget {
  col: number;
  width: number;
  label: string;
  name: string;
}

export interface SnapLineInfo {
  x: number;
  label: string;
  ratio: string;
}

export function useCanvasMediaInteraction(
  artboardPaperRef: Ref<HTMLElement | null>,
  editorDocRef: Ref<HTMLElement | null>,
  zoomRef: Ref<number>,
  artboardInnerWidth: Ref<number>,
  emitChange: () => void
) {
  // 选中的实体外壳 (.canvas-media-shell)
  const selectedShellEl = ref<HTMLElement | null>(null);
  const currentMediaAlign = ref<'left' | 'center' | 'right'>('center');
  const currentShellWidth = ref(420);
  const isCapsuleFlipped = ref(false);

  // 物理级独立的覆盖层几何矩形（以画板 paper 为参考系）
  const overlayRect = ref<OverlayRect | null>(null);

  // 是否处于同行并排容器 (.exam-images-row) 内部
  const isInSideBySideRow = computed(() => {
    if (!selectedShellEl.value) return false;
    return Boolean(selectedShellEl.value.closest('.exam-images-row'));
  });

  // 缩放状态
  const isResizing = ref(false);
  const activeSnapColumn = ref<number | null>(null);
  const snappedBadgeText = ref('');
  const activeSnapLine = ref<SnapLineInfo | null>(null);
  let resizeDirection = 'br';
  let startMouseX = 0;
  let startWidth = 0;

  // 拖动移动状态
  const isDraggingMedia = ref(false);
  const activeDropGuide = ref<DropGuide | null>(null);
  let pendingDropAction: (() => void) | null = null;
  let potentialDragStart = false;
  let dragStartX = 0;
  let dragStartY = 0;

  let shellResizeObserver: ResizeObserver | null = null;
  let paperResizeObserver: ResizeObserver | null = null;

  // 动态生成 12 栏吸附目标
  function getDynamicSnapTargets(): SnapTarget[] {
    const totalW = artboardInnerWidth.value || 700;
    const snapConfigs = [
      { col: 3, ratio: 0.25, name: '25%' },
      { col: 4, ratio: 1 / 3, name: '33%' },
      { col: 5, ratio: 0.416, name: '42%' },
      { col: 6, ratio: 0.5, name: '50%' },
      { col: 7, ratio: 0.583, name: '58%' },
      { col: 8, ratio: 2 / 3, name: '66%' },
      { col: 9, ratio: 0.75, name: '75%' },
      { col: 12, ratio: 1.0, name: '100%' },
    ];

    return snapConfigs.map((cfg) => {
      const w = Math.round(totalW * cfg.ratio);
      return {
        col: cfg.col,
        width: w,
        label: `吸附至 ${cfg.name} 栏宽 (${w}px)`,
        name: cfg.name,
      };
    });
  }

  function updateOverlayRect() {
    if (!selectedShellEl.value || !artboardPaperRef.value) {
      overlayRect.value = null;
      return;
    }
    const shell = selectedShellEl.value;
    const paper = artboardPaperRef.value;
    const shellRect = shell.getBoundingClientRect();
    const paperRect = paper.getBoundingClientRect();
    const scale = (zoomRef.value || 100) / 100;

    const left = (shellRect.left - paperRect.left) / scale;
    const top = (shellRect.top - paperRect.top) / scale;
    const width = shellRect.width / scale;
    const height = shellRect.height / scale;

    overlayRect.value = { left, top, width, height };
    isCapsuleFlipped.value = top < 60;
  }

  function readMediaAlign(shell: HTMLElement) {
    const wrapper = shell.closest('.img') as HTMLElement | null;
    const target = wrapper || shell;
    if (
      target.style.justifyContent === 'flex-start' ||
      target.style.marginLeft === '0px' ||
      target.style.textAlign === 'left'
    ) {
      currentMediaAlign.value = 'left';
    } else if (
      target.style.justifyContent === 'flex-end' ||
      target.style.marginRight === '0px' ||
      target.style.textAlign === 'right'
    ) {
      currentMediaAlign.value = 'right';
    } else {
      currentMediaAlign.value = 'center';
    }
  }

  function selectShell(shell: HTMLElement) {
    if (selectedShellEl.value && selectedShellEl.value !== shell) {
      selectedShellEl.value.classList.remove('is-selected');
    }

    selectedShellEl.value = shell;
    shell.classList.add('is-selected');

    // 选中时暂时关闭全文可编辑，避免原生划词冲突
    editorDocRef.value?.setAttribute('contenteditable', 'false');
    window.getSelection()?.removeAllRanges();

    readMediaAlign(shell);
    currentShellWidth.value = shell.offsetWidth || parseFloat(shell.style.width) || 420;

    updateOverlayRect();

    // 监听外壳自身尺寸变动并同步浮层
    if (shellResizeObserver) shellResizeObserver.disconnect();
    if (window.ResizeObserver) {
      shellResizeObserver = new ResizeObserver(() => {
        updateOverlayRect();
      });
      shellResizeObserver.observe(shell);
    }
  }

  function clearSelection() {
    if (shellResizeObserver) {
      shellResizeObserver.disconnect();
      shellResizeObserver = null;
    }
    if (selectedShellEl.value) {
      selectedShellEl.value.classList.remove('is-selected');
      selectedShellEl.value = null;
    }
    overlayRect.value = null;
    activeSnapLine.value = null;
    if (editorDocRef.value) {
      editorDocRef.value.setAttribute('contenteditable', 'true');
    }
  }

  // --- 磁吸缩放事件 ---
  function startResize(e: MouseEvent, dir: string) {
    if (!selectedShellEl.value) return;
    isResizing.value = true;
    resizeDirection = dir;
    startMouseX = e.clientX;

    window.getSelection()?.removeAllRanges();
    document.body.style.userSelect = 'none';
    (document.body.style as any).webkitUserSelect = 'none';
    editorDocRef.value?.setAttribute('contenteditable', 'false');

    const rect = selectedShellEl.value.getBoundingClientRect();
    const scale = (zoomRef.value || 100) / 100;
    startWidth = rect.width / scale;

    const row = selectedShellEl.value.closest('.exam-images-row') as HTMLElement | null;
    const parentImg = selectedShellEl.value.closest('.img') as HTMLElement | null;

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!isResizing.value || !selectedShellEl.value) return;
      const s = (zoomRef.value || 100) / 100;
      const dx = (moveEvt.clientX - startMouseX) / s;

      let candidateWidth = startWidth;
      if (resizeDirection.includes('r')) {
        candidateWidth = startWidth + dx;
      } else if (resizeDirection.includes('l')) {
        candidateWidth = startWidth - dx;
      }

      // 如果处于并排行中，最大宽度不得撑破并排容器（为相邻元素预留至少 120px + 16px gap）
      const totalAvailable = artboardInnerWidth.value || 700;
      const maxAllowed = row
        ? Math.max(160, totalAvailable - 136)
        : totalAvailable;

      candidateWidth = Math.max(80, Math.min(maxAllowed, candidateWidth));

      // 动态计算磁吸死区
      const dynamicTargets = getDynamicSnapTargets();
      const SNAP_THRESHOLD = 16;
      let matchedSnap: SnapTarget | null = null;

      for (const snap of dynamicTargets) {
        if (snap.width <= maxAllowed && Math.abs(candidateWidth - snap.width) <= SNAP_THRESHOLD) {
          matchedSnap = snap;
          break;
        }
      }

      let finalWidth = candidateWidth;
      if (matchedSnap) {
        finalWidth = matchedSnap.width;
        activeSnapColumn.value = matchedSnap.col;
        snappedBadgeText.value = matchedSnap.label;
      } else {
        activeSnapColumn.value = null;
        snappedBadgeText.value = '';
      }

      const pixelWidthStr = `${Math.round(finalWidth)}px`;

      // 施加给当前选中的 Shell
      selectedShellEl.value.style.width = pixelWidthStr;
      currentShellWidth.value = finalWidth;

      // 如果在同行并排容器中，解除均分锁定，让当前元素采用明确宽度，相邻元素吸收剩余空间
      if (row) {
        if (parentImg) {
          parentImg.style.width = pixelWidthStr;
          parentImg.style.flex = `0 0 ${pixelWidthStr}`;
          parentImg.style.maxWidth = `${Math.round(maxAllowed)}px`;
        } else {
          selectedShellEl.value.style.flex = `0 0 ${pixelWidthStr}`;
          selectedShellEl.value.style.maxWidth = `${Math.round(maxAllowed)}px`;
        }

        // 让并排容器内其他兄弟元素弹性自适应
        const rowChildren = Array.from(row.children) as HTMLElement[];
        rowChildren.forEach((child) => {
          if (child !== (parentImg || selectedShellEl.value)) {
            child.style.flex = '1 1 0';
            child.style.minWidth = '120px';
          }
        });
      }

      updateOverlayRect();

      if (matchedSnap && overlayRect.value) {
        const lineX = resizeDirection.includes('r')
          ? overlayRect.value.left + overlayRect.value.width
          : overlayRect.value.left;

        activeSnapLine.value = {
          x: lineX,
          label: `${matchedSnap.name} (${Math.round(finalWidth)}px)`,
          ratio: matchedSnap.name,
        };
      } else {
        activeSnapLine.value = null;
      }
    };

    const onMouseUp = () => {
      isResizing.value = false;
      activeSnapColumn.value = null;
      snappedBadgeText.value = '';
      activeSnapLine.value = null;
      document.body.style.userSelect = '';
      (document.body.style as any).webkitUserSelect = '';

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      updateOverlayRect();
      emitChange();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // --- 自由拖拽重排事件 ---
  function startMoveDrag(_e: MouseEvent) {
    if (!selectedShellEl.value || !editorDocRef.value || !artboardPaperRef.value) return;
    isDraggingMedia.value = true;
    activeDropGuide.value = null;
    pendingDropAction = null;

    const currentBlock = getTopMediaElement(selectedShellEl.value) || selectedShellEl.value;
    const scale = (zoomRef.value || 100) / 100;

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingMedia.value || !editorDocRef.value || !artboardPaperRef.value || !selectedShellEl.value) return;

      const candidateSelectors = 'p, .stem-paragraph, .sub-prompt, .sub-item, .options, .img, table, .exam-images-row';
      const candidates = Array.from(editorDocRef.value.querySelectorAll<HTMLElement>(candidateSelectors))
        .filter((el) => el !== currentBlock && !currentBlock.contains(el) && !el.closest('.shell-interactive-overlay'));

      const artboardRect = artboardPaperRef.value.getBoundingClientRect();
      let closestDist = Infinity;
      let closestEl: HTMLElement | null = null;
      let isSideBySide = false;
      let sidePos: 'left' | 'right' = 'right';
      let insertPos: 'before' | 'after' = 'after';

      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        const isTargetMedia = el.classList.contains('img') || el.tagName.toLowerCase() === 'table' || el.classList.contains('canvas-media-shell');
        const inVerticalBand = moveEvt.clientY >= r.top - 10 && moveEvt.clientY <= r.bottom + 10;

        if (isTargetMedia && inVerticalBand) {
          const distToLeft = Math.abs(moveEvt.clientX - r.left);
          const distToRight = Math.abs(moveEvt.clientX - r.right);
          const minSideDist = Math.min(distToLeft, distToRight);

          if (minSideDist < closestDist && minSideDist < 120) {
            closestDist = minSideDist;
            closestEl = el;
            isSideBySide = true;
            sidePos = distToLeft < distToRight ? 'left' : 'right';
            continue;
          }
        }

        const distTop = Math.abs(moveEvt.clientY - r.top);
        const distBottom = Math.abs(moveEvt.clientY - r.bottom);
        const minDist = Math.min(distTop, distBottom);

        if (minDist < closestDist) {
          closestDist = minDist;
          closestEl = el;
          isSideBySide = false;
          insertPos = distTop <= distBottom ? 'before' : 'after';
        }
      }

      if (closestEl) {
        const r = closestEl.getBoundingClientRect();
        if (isSideBySide) {
          const lineX = (sidePos === 'left' ? r.left : r.right) - artboardRect.left;
          const lineY = r.top - artboardRect.top;
          activeDropGuide.value = {
            type: 'vertical',
            style: {
              left: `${lineX / scale}px`,
              top: `${lineY / scale}px`,
              height: `${r.height / scale}px`,
            },
            badge: '与此图表同行并排',
          };

          const targetMediaEl = getTopMediaElement(closestEl) || closestEl;
          pendingDropAction = () => {
            const row = targetMediaEl.closest('.exam-images-row') as HTMLElement | null;
            if (row) {
              if (sidePos === 'left') {
                row.insertBefore(currentBlock, targetMediaEl);
              } else {
                row.insertBefore(currentBlock, targetMediaEl.nextElementSibling);
              }
            } else {
              const newRow = document.createElement('div');
              newRow.className = 'exam-images-row';
              targetMediaEl.parentElement?.insertBefore(newRow, targetMediaEl);
              if (sidePos === 'left') {
                newRow.appendChild(currentBlock);
                newRow.appendChild(targetMediaEl);
              } else {
                newRow.appendChild(targetMediaEl);
                newRow.appendChild(currentBlock);
              }
            }
          };
        } else {
          const lineY = (insertPos === 'before' ? r.top : r.bottom) - artboardRect.top;
          activeDropGuide.value = {
            type: 'horizontal',
            style: {
              top: `${lineY / scale}px`,
            },
            badge: insertPos === 'before' ? '放置于该段落上方' : '放置于该段落下方',
          };

          const targetEl = closestEl;
          pendingDropAction = () => {
            const parent = targetEl.parentElement;
            if (parent) {
              if (insertPos === 'before') {
                parent.insertBefore(currentBlock, targetEl);
              } else {
                parent.insertBefore(currentBlock, targetEl.nextElementSibling);
              }
            }
          };
        }
      } else {
        activeDropGuide.value = null;
        pendingDropAction = null;
      }
    };

    const onMouseUp = () => {
      isDraggingMedia.value = false;
      activeDropGuide.value = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (pendingDropAction) {
        pendingDropAction();
        pendingDropAction = null;
      }

      updateOverlayRect();
      emitChange();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // 鼠标在选中的 Shell 上直接拖动的初始探测
  function handlePotentialDragStart(e: MouseEvent, shell: HTMLElement) {
    if (shell !== selectedShellEl.value) return;
    potentialDragStart = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const onPotentialMove = (moveEvt: MouseEvent) => {
      if (!potentialDragStart) return;
      const dist = Math.hypot(moveEvt.clientX - dragStartX, moveEvt.clientY - dragStartY);
      if (dist > 5) {
        potentialDragStart = false;
        window.removeEventListener('mousemove', onPotentialMove);
        window.removeEventListener('mouseup', onPotentialUp);
        startMoveDrag(moveEvt);
      }
    };

    const onPotentialUp = () => {
      potentialDragStart = false;
      window.removeEventListener('mousemove', onPotentialMove);
      window.removeEventListener('mouseup', onPotentialUp);
    };

    window.addEventListener('mousemove', onPotentialMove);
    window.addEventListener('mouseup', onPotentialUp);
  }

  // 监听纸张尺寸变动，自动同步浮层坐标
  if (artboardPaperRef.value && window.ResizeObserver) {
    paperResizeObserver = new ResizeObserver(() => {
      updateOverlayRect();
    });
    paperResizeObserver.observe(artboardPaperRef.value);
  }

  onUnmounted(() => {
    if (shellResizeObserver) shellResizeObserver.disconnect();
    if (paperResizeObserver) paperResizeObserver.disconnect();
  });

  return {
    selectedShellEl,
    currentMediaAlign,
    currentShellWidth,
    isCapsuleFlipped,
    isInSideBySideRow,
    overlayRect,
    isResizing,
    activeSnapColumn,
    activeSnapLine,
    snappedBadgeText,
    isDraggingMedia,
    activeDropGuide,
    getDynamicSnapTargets,
    selectShell,
    clearSelection,
    updateOverlayRect,
    startResize,
    startMoveDrag,
    handlePotentialDragStart,
  };
}
