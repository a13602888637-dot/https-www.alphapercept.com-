export interface TemplateBox { x: number; y: number; width: number; height: number }

export const TEMPLATE_BODY = { x: 64, y: 252, width: 952, height: 1410 };

/**
 * News cards stay wide inside the portrait video canvas. Template rotation may
 * change colour, typography and framing, but must never squeeze stories into
 * narrow side-by-side columns.
 */
export function storyTemplateBoxes(_layout: number, count: number): TemplateBox[] {
  if (count <= 0) return [];
  const { x, y, width, height } = TEMPLATE_BODY;
  const gap = 22;
  if (count === 1) {
    const cardHeight = Math.min(720, height);
    return [{ x, y: y + (height - cardHeight) / 2, width, height: cardHeight }];
  }
  const rowHeight = (height - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => ({
    x,
    y: y + index * (rowHeight + gap),
    width,
    height: rowHeight,
  }));
}

export function rankingTemplateBoxes(layout: number, count: number): TemplateBox[] {
  const { x, y, width, height } = TEMPLATE_BODY;
  if (count <= 0) return [];
  const columns = [1, 2, 4, 7].includes(layout) ? 2 : 1;
  const gap = 18;
  const rows = Math.ceil(count / columns);
  const rowHeight = (height - gap * (rows - 1)) / rows;
  const inset = layout === 3 ? 82 : layout === 6 ? 114 : 0;
  const columnWidth = (width - inset - gap * (columns - 1)) / columns;
  return Array.from({ length: count }, (_, index) => {
    // Column-major reading preserves the numeric rank down each column.
    const column = Math.floor(index / rows);
    const row = index % rows;
    return {
      x: x + (layout === 3 ? inset : 0) + column * (columnWidth + gap) + (layout === 5 && row % 2 ? 44 : 0),
      y: y + row * (rowHeight + gap),
      width: columnWidth - (layout === 5 ? 44 : 0), height: rowHeight,
    };
  });
}

export function accountTemplateBoxes(layout: number, count: number): TemplateBox[] {
  if (count <= 0) return [];
  const { x, y, width, height } = TEMPLATE_BODY;
  const gap = 22;
  if ([1, 2, 4, 7].includes(layout)) {
    const rows = Math.ceil(count / 2);
    const rowHeight = (height - gap * (rows - 1)) / rows;
    return Array.from({ length: count }, (_, index) => ({
      x: x + (index % 2) * (width + gap) / 2,
      y: y + Math.floor(index / 2) * (rowHeight + gap),
      width: index === count - 1 && count % 2 ? width : (width - gap) / 2,
      height: rowHeight,
    }));
  }
  const rowHeight = (height - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => ({
    x: x + (layout === 3 ? 72 : layout === 5 && index % 2 ? 52 : 0),
    y: y + index * (rowHeight + gap), width: width - (layout === 3 ? 72 : layout === 5 ? 52 : 0), height: rowHeight,
  }));
}
