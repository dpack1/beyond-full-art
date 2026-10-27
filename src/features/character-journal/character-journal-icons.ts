const SVG_NS = 'http://www.w3.org/2000/svg';

export function journalIcon(doc: Document, paths: readonly string[]): SVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const shape = doc.createElementNS(SVG_NS, 'path');
    shape.setAttribute('d', d);
    shape.setAttribute('fill', 'none');
    shape.setAttribute('stroke', 'currentColor');
    shape.setAttribute('stroke-width', '1.5');
    shape.setAttribute('stroke-linecap', 'round');
    shape.setAttribute('stroke-linejoin', 'round');
    svg.append(shape);
  }
  return svg;
}

export function pencilIcon(doc: Document): SVGElement {
  return journalIcon(doc, [
    'M9.2 2.4l4.4 4.4L6 14.4H1.6V10z',
    'M7.6 4l4.4 4.4',
  ]);
}

export function checkIcon(doc: Document): SVGElement {
  return journalIcon(doc, ['M2.8 8.2l3.2 3.2 7.2-7.4']);
}

export function syncIcon(doc: Document): SVGElement {
  return journalIcon(doc, [
    'M13.2 6A5.4 5.4 0 0 0 3.1 4.2',
    'M3.1 1.8v2.4h2.4',
    'M2.8 10A5.4 5.4 0 0 0 12.9 11.8',
    'M12.9 14.2v-2.4h-2.4',
  ]);
}

export const FORMAT_ICONS = {
  bold: ['M4 2.5h4.2a2.6 2.6 0 0 1 0 5.2H4z', 'M4 7.7h5a2.8 2.8 0 0 1 0 5.6H4z'],
  checkbox: ['M3 3.2h10v10H3z', 'M5.2 8.2l1.8 1.8 3.8-4'],
  heading: ['M3 3.2v9.6', 'M10 3.2v9.6', 'M3 8h7'],
  image: ['M2.4 4h11.2v8.8H2.4z', 'M2.4 11.2l3.2-3 2 1.8 2.2-2.2 3.4 3.4'],
  italic: ['M10 2.6H6.2', 'M9.4 2.6L6.6 13.4', 'M9.8 13.4H6'],
  link: ['M6.6 9.4l2.8-2.8', 'M7.2 5.2l.6-.6a2.6 2.6 0 0 1 3.6 3.6l-.6.6', 'M8.8 10.8l-.6.6a2.6 2.6 0 0 1-3.6-3.6l.6-.6'],
  list: ['M3 4h.1', 'M6 4h7', 'M3 8h.1', 'M6 8h7', 'M3 12h.1', 'M6 12h7'],
} as const;
