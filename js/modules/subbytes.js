// SubBytes / InvSubBytes module: one byte with full S-box derivation, or a whole state
(function () {
  "use strict";
  const { hex2, toHex, SBOX, INV_SBOX } = AES;
  const $ = id => document.getElementById(id);
  const nib = n => n.toString(16).toUpperCase();

  function sboxTable(box, x) {
    const row = x >> 4, col = x & 15;
    let h = `<div class="scroll"><table class="sbox"><tr><th></th>`;
    for (let c = 0; c < 16; c++) h += `<th class="${c === col ? "lane" : ""}">${nib(c)}</th>`;
    h += "</tr>";
    for (let r = 0; r < 16; r++) {
      h += `<tr><th class="${r === row ? "lane" : ""}">${nib(r)}</th>`;
      for (let c = 0; c < 16; c++) {
        const cls = r === row && c === col ? "hit" : r === row || c === col ? "lane" : "";
        h += `<td class="${cls}">${hex2(box[r * 16 + c])}</td>`;
      }
      h += "</tr>";
    }
    return h + `</table></div>`;
  }

  // Per-bit table for the affine transform (forward or inverse)
  function affineTable(aff, inverse) {
    const constName = inverse ? "d" : "c";
    let h = `<div class="scroll"><table class="data"><tr><th>Bit i</th>`;
    aff.rows[0].idx.forEach((_, j) => { h += `<th>${inverse ? "y" : "b"}<sub>${j === 0 && !inverse ? "i" : `i+${inverse ? [2, 5, 7][j] : j + 3}`}</sub></th>`; });
    h += `<th>${constName}<sub>i</sub></th><th>Result bit</th></tr>`;
    for (let i = 7; i >= 0; i--) {
      const r = aff.rows[i];
      h += `<tr><td class="m">${i}</td>`;
      r.terms.forEach((t, j) => { h += `<td class="m">${t} <span class="bitref">(bit ${r.idx[j]})</span></td>`; });
      h += `<td class="m">${r.c}</td><td class="m k">${r.r}</td></tr>`;
    }
    return h + `</table></div>`;
  }

  function renderByte(x, inv) {
    const box = inv ? INV_SBOX : SBOX;
    const name = inv ? "InvSubBytes" : "SubBytes";
    const X = hex2(x);
    let h = R.step(1, "Look the byte up in the table",
      `<p>Split <span class="m">${X}</span> into nibbles: row <span class="m k">${nib(x >> 4)}</span> (high 4 bits), column <span class="m k">${nib(x & 15)}</span> (low 4 bits). The ${inv ? "inverse S-box" : "S-box"} entry there is <span class="m k">${hex2(box[x])}</span>.</p>
      ${sboxTable(box, x)}`);

    if (!inv) {
      const t = AES.subByteTrace(x);
      const invNote = x === 0
        ? `<p>00 has no inverse, so by definition it maps to <span class="m k">00</span>.</p>`
        : `<p>Find the byte that multiplies with <span class="m">${X}</span> to give 01: <span class="m">${X}<sup>&minus;1</sup> = <span class="k">${hex2(t.inverse)}</span></span>.</p>
           <details class="prod"><summary><span>Check: ${X}&middot;${hex2(t.inverse)} = <span class="k">01</span></span><span class="hint">show steps</span></summary>
           <div class="inner">${R.renderMul(x, t.inverse, true)}</div></details>`;
      h += R.step(2, "Take the multiplicative inverse in GF(2<sup>8</sup>)", invNote);
      const a = affineTable(t.affine, false);
      h += R.step(3, "Apply the affine transform",
        `<p>Each output bit is <span class="m">b&prime;<sub>i</sub> = b<sub>i</sub> &oplus; b<sub>i+4</sub> &oplus; b<sub>i+5</sub> &oplus; b<sub>i+6</sub> &oplus; b<sub>i+7</sub> &oplus; c<sub>i</sub></span>, with indices mod 8 and <span class="m">c = 63 = 0110 0011</span>. Input b = <span class="m">${hex2(t.inverse)} = ${R.bits(t.inverse)}</span>.</p>
        ${a}
        <p>Reading the result bits from 7 down to 0: <span class="m">${R.bits(t.result)} = <span class="k">${hex2(t.result)}</span></span>.</p>`);
    } else {
      const t = AES.invSubByteTrace(x);
      const a = affineTable(t.affine, true);
      h += R.step(2, "Undo the affine transform",
        `<p>Each bit is <span class="m">b<sub>i</sub> = y<sub>i+2</sub> &oplus; y<sub>i+5</sub> &oplus; y<sub>i+7</sub> &oplus; d<sub>i</sub></span>, with indices mod 8 and <span class="m">d = 05 = 0000 0101</span>. Input y = <span class="m">${X} = ${R.bits(x)}</span>.</p>
        ${a}
        <p>Result: <span class="m">${R.bits(t.affine.result)} = <span class="k">${hex2(t.affine.result)}</span></span>.</p>`);
      const b = t.affine.result;
      const invNote = b === 0
        ? `<p>The value is 00, which maps to <span class="m k">00</span>.</p>`
        : `<p><span class="m">${hex2(b)}<sup>&minus;1</sup> = <span class="k">${hex2(t.inverse)}</span></span>.</p>
           <details class="prod"><summary><span>Check: ${hex2(b)}&middot;${hex2(t.inverse)} = <span class="k">01</span></span><span class="hint">show steps</span></summary>
           <div class="inner">${R.renderMul(b, t.inverse, true)}</div></details>`;
      h += R.step(3, "Take the multiplicative inverse in GF(2<sup>8</sup>)", invNote);
    }
    h += R.step("&check;", "Result", `<p><span class="m">${name}(${X}) = <span class="k">${hex2(box[x])}</span></span>, which matches the table in step 1.</p>`, "check");
    return h;
  }

  function renderState(s, inv) {
    const box = inv ? INV_SBOX : SBOX;
    const out = s.map(b => box[b]);
    const dir = inv ? "inv" : "fwd";
    let h = R.step(1, `Replace every byte using the ${inv ? "inverse S-box" : "S-box"}`,
      `<div class="flow">${R.grid(s, { cap: "Input state" })}<span class="arrow">&rarr;</span>${R.grid(out, { cap: inv ? "After InvSubBytes" : "After SubBytes" })}</div>
      <p class="note">Each byte is handled on its own. Position in the state does not matter.</p>`);
    let t = `<div class="scroll"><table class="data"><tr><th>Position (row, col)</th><th>Byte</th><th>Row</th><th>Column</th><th>Result</th><th></th></tr>`;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      const b = s[r + 4 * c];
      t += `<tr><td class="m dim">(${r}, ${c})</td><td class="m">${hex2(b)}</td><td class="m">${nib(b >> 4)}</td><td class="m">${nib(b & 15)}</td><td class="m k">${hex2(box[b])}</td>
        <td>${R.openBtn("sub", { mode: "byte", byte: hex2(b), dir }, "Show working")}</td></tr>`;
    }
    h += R.step(2, "Every lookup, column by column", t + `</table></div>`);
    return { html: h, out };
  }

  function render() {
    const inv = R.segVal("sb-dir") === "inv";
    const mode = R.segVal("sb-mode");
    $("sb-byte-wrap").hidden = mode !== "byte";
    $("sb-state-wrap").hidden = mode !== "state";
    if (mode === "byte") {
      const x = AES.parseByte($("sb-byte").value);
      if (x === null) {
        R.showError("sb-err", "Enter 1–2 hex digits (0–9, A–F), like 53.");
        $("sb-out").textContent = "??"; $("sb-steps").innerHTML = "";
        return;
      }
      R.showError("sb-err", "");
      $("sb-out").textContent = hex2((inv ? INV_SBOX : SBOX)[x]);
      $("sb-steps").innerHTML = renderByte(x, inv);
    } else {
      const s = R.readHex("sb-state", 16);
      if (!s) {
        R.showError("sb-err", "The state needs 16 bytes: 32 hex digits.");
        $("sb-out").textContent = " "; $("sb-steps").innerHTML = "";
        return;
      }
      R.showError("sb-err", "");
      const r = renderState(s, inv);
      $("sb-out").textContent = toHex(r.out, " ");
      $("sb-steps").innerHTML = r.html;
    }
  }

  App.register({
    id: "sub",
    group: "phase",
    title: "SubBytes",
    blurb: "Substitute bytes through the AES S-box. For a single byte you also see how the S-box value is built: a GF(2⁸) inverse followed by the affine transform.",
    html: () => `
      <div class="panel">
        <div class="inputs">
          ${R.seg("sb-dir", "Direction", [["fwd", "SubBytes"], ["inv", "InvSubBytes"]], "fwd")}
          ${R.seg("sb-mode", "Input", [["byte", "Single byte"], ["state", "Whole state"]], "byte")}
        </div>
        <div class="inputs">
          <div id="sb-byte-wrap">${R.byteField("sb-byte", "Byte", "53")}</div>
          <div id="sb-state-wrap" class="field grow" hidden>${R.longField("sb-state", "State (16 bytes, column by column)", "193de3bea0f4e22b9ac68d2ae9f84808")}</div>
          ${R.resultBox("sb-out", "Result", true)}
        </div>
        <p class="error" id="sb-err" hidden></p>
      </div>
      <div class="steps" id="sb-steps"></div>`,
    init() {
      ["sb-dir", "sb-mode"].forEach(id => $(id).addEventListener("change", render));
      ["sb-byte", "sb-state"].forEach(id => $(id).addEventListener("input", render));
      render();
    },
    load(d) {
      if (d.dir) R.setSeg("sb-dir", d.dir);
      if (d.mode) R.setSeg("sb-mode", d.mode);
      if (d.byte) $("sb-byte").value = d.byte;
      if (d.state) $("sb-state").value = d.state;
      render();
    },
  });
})();
