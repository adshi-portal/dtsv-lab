// Детермінований генератор псевдовипадкових чисел для відтворюваних варіантів.
// Варіант повністю визначається рядком-ідентифікатором.

/** FNV-1a 32-bit hash рядка (UTF-16 коди символів). */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: повертає функцію, що дає числа з [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(id) {
  const next = mulberry32(hashString(String(id)));
  return {
    next,
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

/** Короткий ідентифікатор варіанта: PR1-XXXXXX. */
export function makeVariantId(work, group, name, number) {
  const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const h = hashString(`${work}|${norm(group)}|${norm(name)}|${number}`);
  return `PR${work}-${h.toString(36).toUpperCase().padStart(7, '0')}`;
}
