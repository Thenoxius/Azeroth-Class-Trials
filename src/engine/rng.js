// Seeded xorshift RNG so fights are reproducible (bots, tests, replays).
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 0x9e3779b9;
  const f = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.chance = (p) => f() < p;
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
