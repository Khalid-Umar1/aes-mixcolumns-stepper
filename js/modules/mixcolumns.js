// MixColumns / InvMixColumns module: two bytes (GF(2^8) multiply), one column, or a whole state
(function () {
  "use strict";
  const { hex2, toHex, MIX, INV_MIX } = AES;
  const $ = id => document.getElementById(id);

  // Steps for one column; prefix lets the whole-state view label rows per column
  function columnSteps(col, m, startNo, prefix = "") {
    const rows = AES.mixColumnTrace(col, m);
    let h = "";
    rows.forEach((r, i) => {
      const formula = r.terms.map(t => `${hex2(t.a)}&middot;${hex2(t.b)}`).join(" &oplus; ");
      let body = `<div class="row-formula">s&prime;<sub>${i}</sub> = ${formula}</div><div class="prod-list">`;
      r.terms.forEach(t => {
        const how = t.a === 1 ? "identity" : t.used.length === 1 ? "xtime only" : "xtime, then XOR";
        body += `<details class="prod"><summary><span>${hex2(t.a)}&middot;${hex2(t.b)} = <span class="k">${hex2(t.result)}</span></span><span class="hint">${how} &middot; show steps</span></summary><div class="inner">${R.renderMul(t.a, t.b, true)}</div></details>`;
      });
      body += `</div>` + R.xorStack(r.terms.map(t => ({ value: t.result, label: `${hex2(t.a)}&middot;${hex2(t.b)}` })), r.result, `s&prime;<sub>${i}</sub>`);
      h += R.step(startNo + i, `${prefix}Row ${i}: s&prime;<sub>${i}</sub> = ${hex2(r.result)}`, body);
    });
    return { html: h, out: rows.map(r => r.result) };
  }

  function matrixEq(m, col, out) {
    return `<div class="eq">
      <div class="mat m4">${m.flat().map(v => `<span>${hex2(v)}</span>`).join("")}</div>
      <span class="sym">&middot;</span>
      <div class="mat m1">${col.map(v => `<span>${hex2(v)}</span>`).join("")}</div>
      <span class="sym">=</span>
      <div class="mat m1 res">${out.map(v => `<span>${hex2(v)}</span>`).join("")}</div>
    </div>`;
  }

  function renderPair() {
    const a = AES.parseByte($("mc-a").value), b = AES.parseByte($("mc-b").value);
    if (a === null || b === null) {
      R.showError("mc-err", `Enter 1–2 hex digits (0–9, A–F) in ${a === null ? "the constant" : "the byte"}, like 02 or D4.`);
      $("mc-out").textContent = "??"; $("mc-steps").innerHTML = "";
      return;
    }
    R.showError("mc-err", "");
    $("mc-out").textContent = hex2(AES.mul(a, b));
    $("mc-steps").innerHTML = R.renderMul(a, b);
  }

  function renderColumn(m) {
    const col = R.readHex("mc-col", 4);
    if (!col) {
      R.showError("mc-err", "Enter exactly 4 bytes (8 hex digits), like D4 BF 5D 30.");
      $("mc-out").textContent = " "; $("mc-steps").innerHTML = "";
      return;
    }
    R.showError("mc-err", "");
    const c = columnSteps(col, m, 2);
    $("mc-out").textContent = toHex(c.out, " ");
    $("mc-steps").innerHTML = R.step(1, "Set up the matrix product",
      `${matrixEq(m, col, c.out)}<p class="note">Row i of the matrix times the column gives byte i of the new column. Multiplication is in GF(2<sup>8</sup>) and the sum is XOR. Open any product to see its full working.</p>`) + c.html;
  }

  function renderState(m, inv) {
    const s = R.readHex("mc-state", 16);
    if (!s) {
      R.showError("mc-err", "The state needs 16 bytes: 32 hex digits.");
      $("mc-out").textContent = " "; $("mc-steps").innerHTML = "";
      return;
    }
    R.showError("mc-err", "");
    const out = inv ? AES.invMixColumns(s) : AES.mixColumns(s);
    $("mc-out").textContent = toHex(out, " ");
    let h = R.step(1, "Treat each column on its own",
      `<div class="flow">${R.grid(s, { cap: "Before" })}<span class="arrow">&rarr;</span>${R.grid(out, { cap: inv ? "After InvMixColumns" : "After MixColumns" })}</div>
      <p class="note">The same matrix multiplies each of the 4 columns. Open a column below for its working.</p>`);
    for (let c = 0; c < 4; c++) {
      const col = s.slice(4 * c, 4 * c + 4);
      const cs = columnSteps(col, m, 1);
      h += `<details class="round"${c === 0 ? " open" : ""}><summary><h3>Column ${c}</h3><span class="ops m">${toHex(col, " ")} &rarr; ${toHex(cs.out, " ")}</span></summary>
        <div class="round-body">${R.step("=", "Matrix product", matrixEq(m, col, cs.out))}${cs.html}</div></details>`;
    }
    $("mc-steps").innerHTML = h;
  }

  function render() {
    const mode = R.segVal("mc-mode");
    const inv = R.segVal("mc-dir") === "inv";
    $("mc-pair").hidden = mode !== "pair";
    $("mc-col-wrap").hidden = mode !== "col";
    $("mc-state-wrap").hidden = mode !== "state";
    $("mc-dir-wrap").hidden = mode === "pair";
    if (mode === "pair") renderPair();
    else if (mode === "col") renderColumn(inv ? INV_MIX : MIX);
    else renderState(inv ? INV_MIX : MIX, inv);
  }

  App.register({
    id: "mix",
    group: "phase",
    title: "MixColumns",
    blurb: "Multiply state columns by the fixed MixColumns matrix in GF(2⁸). Use Two bytes for a single product such as 02·D4, which is the core of every MixColumns calculation.",
    html: () => `
      <div class="panel">
        <div class="inputs">
          ${R.seg("mc-mode", "Input", [["pair", "Two bytes"], ["col", "One column"], ["state", "Whole state"]], "pair")}
          <div id="mc-dir-wrap" hidden>${R.seg("mc-dir", "Matrix", [["fwd", "MixColumns"], ["inv", "InvMixColumns"]], "fwd")}</div>
        </div>
        <div id="mc-pair" style="display:grid;gap:12px">
          <div class="inputs">
            ${R.byteField("mc-a", "Matrix constant", "03")}
            <div class="op" aria-hidden="true">&middot;</div>
            ${R.byteField("mc-b", "State byte", "D4")}
            <div class="op" aria-hidden="true">=</div>
          </div>
          <div class="chips" id="mc-chips">
            Constant:
            <button type="button" data-v="01">01</button><button type="button" data-v="02">02</button><button type="button" data-v="03">03</button>
            <span class="sep" aria-hidden="true"></span>
            inverse:
            <button type="button" data-v="09">09</button><button type="button" data-v="0B">0B</button><button type="button" data-v="0D">0D</button><button type="button" data-v="0E">0E</button>
          </div>
        </div>
        <div class="inputs">
          <div id="mc-col-wrap" class="field grow" hidden>${R.longField("mc-col", "Column (4 bytes, top to bottom)", "D4 BF 5D 30")}</div>
          <div id="mc-state-wrap" class="field grow" hidden>${R.longField("mc-state", "State (16 bytes, column by column)", "d4bf5d30e0b452aeb84111f11e2798e5")}</div>
          ${R.resultBox("mc-out", "Result", true)}
        </div>
        <p class="error" id="mc-err" hidden></p>
      </div>
      <div class="steps" id="mc-steps"></div>`,
    init() {
      ["mc-mode", "mc-dir"].forEach(id => $(id).addEventListener("change", render));
      ["mc-a", "mc-b", "mc-col", "mc-state"].forEach(id => $(id).addEventListener("input", render));
      $("mc-chips").addEventListener("click", e => {
        const v = e.target.closest("button")?.dataset.v;
        if (v) { $("mc-a").value = v; render(); }
      });
      render();
    },
    load(d) {
      if (d.mode) R.setSeg("mc-mode", d.mode);
      if (d.dir) R.setSeg("mc-dir", d.dir);
      if (d.state) $("mc-state").value = d.state;
      if (d.col) $("mc-col").value = d.col;
      render();
    },
  });
})();
