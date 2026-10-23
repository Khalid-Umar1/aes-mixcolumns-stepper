// Checks js/aes-core.js against FIPS-197 test values.
// Run with: node tests/run-tests.js
const AES = require("../js/aes-core.js");

let failed = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got ${got}, want ${want}`}`);
}
const hex = b => AES.toHex(b).toLowerCase();

// GF(2^8) and S-box
check("57 * 83 = C1", AES.hex2(AES.mul(0x57, 0x83)), "C1");
check("02 * D4 = B3", AES.hex2(AES.mulTrace(2, 0xD4).result), "B3");
check("S-box[53] = ED", AES.hex2(AES.SBOX[0x53]), "ED");
check("S-box[00] = 63", AES.hex2(AES.SBOX[0x00]), "63");
check("InvS-box[ED] = 53", AES.hex2(AES.INV_SBOX[0xED]), "53");
check("inverse affine matches InvS-box",
  [...Array(256).keys()].every(y => AES.invSubByteTrace(y).inverse === AES.INV_SBOX[y]), true);
let mism = 0;
for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) if (AES.mulTrace(a, b).result !== AES.polyMul(a, b).result) mism++;
check("xtime and polynomial methods agree on all pairs", mism, 0);

// Round operations
const col = [0xD4, 0xBF, 0x5D, 0x30];
check("MixColumns D4BF5D30", hex(AES.mixColumnTrace(col, AES.MIX).map(r => r.result)), "046681e5");
const s = AES.parseHex("00112233445566778899aabbccddeeff");
check("InvShiftRows(ShiftRows(s)) = s", hex(AES.invShiftRows(AES.shiftRows(s))), hex(s));
check("InvMixColumns(MixColumns(s)) = s", hex(AES.invMixColumns(AES.mixColumns(s))), hex(s));

// Key expansion (FIPS-197 Appendix A)
const ka = AES.keyExpansion(AES.parseHex("2b7e151628aed2a6abf7158809cf4f3c"), 128);
check("AES-128 w[43]", hex(ka.words[43]), "b6630ca6");
const kb = AES.keyExpansion(AES.parseHex("8e73b0f7da0e6452c810f32b809079e562f8ead2522c6b7b"), 192);
check("AES-192 w[51]", hex(kb.words[51]), "01002202");
const kc = AES.keyExpansion(AES.parseHex("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4"), 256);
check("AES-256 w[59]", hex(kc.words[59]), "706c631e");

// Full cipher (FIPS-197 Appendix B and C)
const b = AES.encrypt(AES.parseHex("3243f6a8885a308d313198a2e0370734"), AES.parseHex("2b7e151628aed2a6abf7158809cf4f3c"), 128);
check("Appendix B ciphertext", hex(b.output), "3925841d02dc09fbdc118597196a0b32");
for (const bits of [128, 192, 256]) {
  const ex = AES.EXAMPLES[bits];
  const key = AES.parseHex(ex.key), pt = AES.parseHex(ex.plain);
  const enc = AES.encrypt(pt, key, bits);
  check(`AES-${bits} encrypt`, hex(enc.output), ex.cipher);
  check(`AES-${bits} rounds`, enc.rounds.length - 1, AES.VARIANTS[bits].Nr);
  check(`AES-${bits} decrypt`, hex(AES.decrypt(enc.output, key, bits).output), ex.plain);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
