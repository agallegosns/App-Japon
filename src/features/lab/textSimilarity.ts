/** Proporción (0–1) de caracteres esperados reconocidos en orden (subsecuencia común más larga), sin espacios. */
export function lcsRatio(expected: string, actual: string): number {
  const a = [...expected.replace(/\s+/g, '')];
  const b = [...actual.replace(/\s+/g, '')];
  if (a.length === 0) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? (prev[j - 1] ?? 0) + 1 : Math.max(prev[j] ?? 0, cur[j - 1] ?? 0);
    }
    prev = cur;
  }
  return (prev[b.length] ?? 0) / a.length;
}
