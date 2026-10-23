// AES core: GF(2^8) arithmetic, S-box, round operations, key expansion and
// traced encrypt/decrypt. Pure functions only, no DOM access, so the same file
// runs in the browser (window.AES) and in Node (tests/run-tests.js).
(function (root) {
  "use strict";

  const M_POLY = 0x11B;

  const VARIANTS = {
    128: { bits: 128, Nk: 4, Nr: 10 },
    192: { bits: 192, Nk: 6, Nr: 12 },
    256: { bits: 256, Nk: 8, Nr: 14 },
  };

  const MIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
  const INV_MIX = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]];

  // ---------- GF(2^8) ----------

  function xtime(v) {
    const overflow = (v & 0x80) !== 0;
    const shifted = (v << 1) & 0xFF;
    return { input: v, overflow, shifted, result: overflow ? shifted ^ 0x1B : shifted };
  }

  function mul(a, b) {
    let p = 0;
    while (b) {
      if (b & 1) p ^= a;
      a = xtime(a).result;
      b >>= 1;
    }
    return p;
  }

  // a = constant (its bits pick terms), b = byte (gets doubled repeatedly)
  function mulTrace(a, b) {
    const chain = [{ power: 0, value: b, step: null }];
    const top = a ? 31 - Math.clz32(a) : 0;
    for (let i = 1; i <= top; i++) {
      const st = xtime(chain[i - 1].value);
      chain.push({ power: i, value: st.result, step: st });
    }
    const used = chain.filter(c => (a >> c.power) & 1);
    const result = used.reduce((acc, c) => acc ^ c.value, 0);
    return { a, b, chain, used, result };
  }

  // Carry-less multiply, then long division by m(x)
  function polyMul(a, b) {
    const partials = [];
    let product = 0;
    for (let i = 0; i < 8; i++) {
      if ((a >> i) & 1) { partials.push({ shift: i, value: b << i }); product ^= b << i; }
    }
    const reductions = [];
    let r = product;
    for (let d = 14; d >= 8; d--) {
      if ((r >> d) & 1) {
        const sub = M_POLY << (d - 8);
        reductions.push({ degree: d, before: r, sub, after: r ^ sub });
        r ^= sub;
      }
    }
    return { partials, product, reductions, result: r };
  }

  const INVERSE = new Array(256).fill(0);
  for (let a = 1; a < 256; a++) {
    for (let x = 1; x < 256; x++) {
      if (mul(a, x) === 1) { INVERSE[a] = x; break; }
    }
  }

  // ---------- S-box ----------

  const bit = (v, i) => (v >> (((i % 8) + 8) % 8)) & 1;

  // b'_i = b_i ^ b_(i+4) ^ b_(i+5) ^ b_(i+6) ^ b_(i+7) ^ c_i, c = 63
  function affineTrace(b) {
    const rows = [];
    let out = 0;
    for (let i = 0; i < 8; i++) {
      const terms = [bit(b, i), bit(b, i + 4), bit(b, i + 5), bit(b, i + 6), bit(b, i + 7)];
      const c = bit(0x63, i);
      const r = terms.reduce((x, y) => x ^ y, c);
      rows.push({ i, idx: [i, (i + 4) % 8, (i + 5) % 8, (i + 6) % 8, (i + 7) % 8], terms, c, r });
      out |= r << i;
    }
    return { input: b, rows, result: out };
  }

  // b_i = y_(i+2) ^ y_(i+5) ^ y_(i+7) ^ d_i, d = 05
  function invAffineTrace(y) {
    const rows = [];
    let out = 0;
    for (let i = 0; i < 8; i++) {
      const terms = [bit(y, i + 2), bit(y, i + 5), bit(y, i + 7)];
      const c = bit(0x05, i);
      const r = terms.reduce((x, z) => x ^ z, c);
      rows.push({ i, idx: [(i + 2) % 8, (i + 5) % 8, (i + 7) % 8], terms, c, r });
      out |= r << i;
    }
    return { input: y, rows, result: out };
  }

  const SBOX = new Array(256);
  const INV_SBOX = new Array(256);
  for (let x = 0; x < 256; x++) {
    const s = affineTrace(INVERSE[x]).result;
    SBOX[x] = s;
    INV_SBOX[s] = x;
  }

  function subByteTrace(x) {
    const inv = INVERSE[x];
    const aff = affineTrace(inv);
    return { input: x, row: x >> 4, col: x & 15, inverse: inv, affine: aff, result: SBOX[x] };
  }

  function invSubByteTrace(y) {
    const aff = invAffineTrace(y);
    const inv = INVERSE[aff.result];
    return { input: y, row: y >> 4, col: y & 15, affine: aff, inverse: inv, result: INV_SBOX[y] };
  }

  // ---------- Round operations on a 16-byte state ----------
  // Bytes fill the state column by column: state[r][c] = s[r + 4c].

  const subBytes = s => s.map(b => SBOX[b]);
  const invSubBytes = s => s.map(b => INV_SBOX[b]);

  function shiftRows(s) {
    const o = new Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r + 4 * c] = s[r + 4 * ((c + r) % 4)];
    return o;
  }

  function invShiftRows(s) {
    const o = new Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r + 4 * c] = s[r + 4 * ((c - r + 4) % 4)];
    return o;
  }

  function mixColumnTrace(col, m) {
    return m.map(row => {
      const terms = row.map((k, c) => mulTrace(k, col[c]));
      return { row, terms, result: terms.reduce((x, t) => x ^ t.result, 0) };
    });
  }

  function mixColumnsWith(s, m) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) {
      const col = s.slice(4 * c, 4 * c + 4);
      for (let r = 0; r < 4; r++) {
        o[4 * c + r] = m[r].reduce((x, k, j) => x ^ mul(k, col[j]), 0);
      }
    }
    return o;
  }

  const mixColumns = s => mixColumnsWith(s, MIX);
  const invMixColumns = s => mixColumnsWith(s, INV_MIX);
  const addRoundKey = (s, k) => s.map((b, i) => b ^ k[i]);

  // ---------- Key expansion ----------

  const RCON = [0x00];
  for (let i = 1; i <= 10; i++) RCON[i] = i === 1 ? 0x01 : xtime(RCON[i - 1]).result;

  const xorWord = (a, b) => a.map((v, i) => v ^ b[i]);
  const rotWord = w => [w[1], w[2], w[3], w[0]];
  const subWord = w => w.map(b => SBOX[b]);

  function keyExpansion(key, bits) {
    const v = VARIANTS[bits];
    if (!v) throw new Error("Unknown AES variant: " + bits);
    if (key.length !== v.Nk * 4) throw new Error(`AES-${bits} needs a ${v.Nk * 4}-byte key`);
    const { Nk, Nr } = v;
    const total = 4 * (Nr + 1);
    const w = [];
    const trace = [];
    for (let i = 0; i < Nk; i++) {
      w[i] = key.slice(4 * i, 4 * i + 4);
      trace.push({ i, kind: "key", result: w[i] });
    }
    for (let i = Nk; i < total; i++) {
      const t = { i, kind: "plain", temp: w[i - 1] };
      let temp = w[i - 1];
      if (i % Nk === 0) {
        t.kind = "rcon";
        t.rot = rotWord(temp);
        t.sub = subWord(t.rot);
        t.rconIndex = i / Nk;
        t.rcon = [RCON[i / Nk], 0, 0, 0];
        t.afterRcon = xorWord(t.sub, t.rcon);
        temp = t.afterRcon;
      } else if (Nk > 6 && i % Nk === 4) {
        t.kind = "sub";
        t.sub = subWord(temp);
        temp = t.sub;
      }
      t.prev = w[i - Nk];
      t.result = xorWord(t.prev, temp);
      w[i] = t.result;
      trace.push(t);
    }
    const roundKeys = [];
    for (let r = 0; r <= Nr; r++) roundKeys.push([].concat(w[4 * r], w[4 * r + 1], w[4 * r + 2], w[4 * r + 3]));
    return { ...v, words: w, trace, roundKeys };
  }

  // ---------- Cipher with full trace ----------
  // Each round is { index, steps: [{ op, input, output, key? }] }

  function encrypt(block, key, bits) {
    const ks = keyExpansion(key, bits);
    const rounds = [];
    let s = block.slice();
    const step = (list, op, fn, k) => {
      const out = fn(s);
      list.push({ op, input: s, output: out, key: k });
      s = out;
    };
    const r0 = [];
    step(r0, "AddRoundKey", x => addRoundKey(x, ks.roundKeys[0]), ks.roundKeys[0]);
    rounds.push({ index: 0, steps: r0 });
    for (let r = 1; r <= ks.Nr; r++) {
      const list = [];
      step(list, "SubBytes", subBytes);
      step(list, "ShiftRows", shiftRows);
      if (r < ks.Nr) step(list, "MixColumns", mixColumns);
      step(list, "AddRoundKey", x => addRoundKey(x, ks.roundKeys[r]), ks.roundKeys[r]);
      rounds.push({ index: r, steps: list });
    }
    return { mode: "encrypt", bits, keySchedule: ks, input: block, rounds, output: s };
  }

  // Inverse cipher as written in FIPS-197 section 5.3
  function decrypt(block, key, bits) {
    const ks = keyExpansion(key, bits);
    const rounds = [];
    let s = block.slice();
    const step = (list, op, fn, k) => {
      const out = fn(s);
      list.push({ op, input: s, output: out, key: k });
      s = out;
    };
    const r0 = [];
    step(r0, "AddRoundKey", x => addRoundKey(x, ks.roundKeys[ks.Nr]), ks.roundKeys[ks.Nr]);
    rounds.push({ index: 0, keyIndex: ks.Nr, steps: r0 });
    for (let r = ks.Nr - 1; r >= 0; r--) {
      const list = [];
      step(list, "InvShiftRows", invShiftRows);
      step(list, "InvSubBytes", invSubBytes);
      step(list, "AddRoundKey", x => addRoundKey(x, ks.roundKeys[r]), ks.roundKeys[r]);
      if (r > 0) step(list, "InvMixColumns", invMixColumns);
      rounds.push({ index: ks.Nr - r, keyIndex: r, steps: list });
    }
    return { mode: "decrypt", bits, keySchedule: ks, input: block, rounds, output: s };
  }

  // ---------- Parsing ----------

  // Accepts spaces, commas, colons and 0x prefixes. Returns byte array or null.
  function parseHex(str, length) {
    const s = String(str).replace(/0x/gi, "").replace(/[\s,:]+/g, "");
    if (!/^[0-9a-f]*$/i.test(s) || s.length % 2 !== 0) return null;
    const out = [];
    for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16));
    if (length !== undefined && out.length !== length) return null;
    return out;
  }

  function parseByte(str) {
    const s = String(str).trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]{1,2}$/i.test(s)) return null;
    return parseInt(s, 16);
  }

  const hex2 = n => n.toString(16).toUpperCase().padStart(2, "0");
  const toHex = (bytes, sep = "") => bytes.map(hex2).join(sep);

  // FIPS-197 Appendix C example vectors
  const EXAMPLES = {
    128: { key: "000102030405060708090a0b0c0d0e0f", plain: "00112233445566778899aabbccddeeff", cipher: "69c4e0d86a7b0430d8cdb78070b4c55a" },
    192: { key: "000102030405060708090a0b0c0d0e0f1011121314151617", plain: "00112233445566778899aabbccddeeff", cipher: "dda97ca4864cdfe06eaf70a0ec0d7191" },
    256: { key: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", plain: "00112233445566778899aabbccddeeff", cipher: "8ea2b7ca516745bfeafc49904b496089" },
  };

  const AES = {
    M_POLY, VARIANTS, MIX, INV_MIX, SBOX, INV_SBOX, INVERSE, RCON, EXAMPLES,
    xtime, mul, mulTrace, polyMul,
    affineTrace, invAffineTrace, subByteTrace, invSubByteTrace,
    subBytes, invSubBytes, shiftRows, invShiftRows,
    mixColumnTrace, mixColumns, invMixColumns, addRoundKey,
    rotWord, subWord, xorWord, keyExpansion,
    encrypt, decrypt,
    parseHex, parseByte, hex2, toHex,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = AES;
  else root.AES = AES;
})(typeof window !== "undefined" ? window : globalThis);
