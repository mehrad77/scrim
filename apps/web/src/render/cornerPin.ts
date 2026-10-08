type Pt = { x: number; y: number };

/**
 * CSS matrix3d mapping the rectangle (0,0)-(w,h) onto four pinned corners
 * (top-left, top-right, bottom-right, bottom-left), for simple keystone
 * correction. Solves the 8-unknown homography directly.
 */
export function cornerPinMatrix(w: number, h: number, offsets: [Pt, Pt, Pt, Pt]): string {
  const src: Pt[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const dst = src.map((p, i) => ({ x: p.x + offsets[i]!.x, y: p.y + offsets[i]!.y }));
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i]!;
    const d = dst[i]!;
    a.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
    b.push(d.x);
    a.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
    b.push(d.y);
  }
  const hm = solve(a, b);
  if (!hm) return 'none';
  const [h0, h1, h2, h3, h4, h5, h6, h7] = hm as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  // Column-major 4x4 with the homography in the x/y/w rows and columns.
  const m = [h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(10)).join(',')})`;
}

export function hasPin(offsets?: [Pt, Pt, Pt, Pt]): offsets is [Pt, Pt, Pt, Pt] {
  return !!offsets && offsets.some((p) => p.x !== 0 || p.y !== 0);
}

function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}
