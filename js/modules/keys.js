// Key Expansion module: derives every word w[i] for AES-128/192/256
(function () {
  "use strict";
  const { hex2, toHex, VARIANTS, EXAMPLES, SBOX, RCON } = AES;
  const $ = id => document.getElementById(id);
  let ks = null;

  const dash = `<td class="dim">&mdash;</td>`;

  // Word-wise XOR shown byte by byte in binary
  function wordXor(rows, total, totalLabel) {
    const line = w => w.map(b => R.bits(b)).join(`<span class="gap"></span><span class="gap"></span>`);
    let h = `<div class="scroll"><table class="bits">`;
    rows.forEach((r, i) => {
      h += `<tr><td class="sym">${i ? "&oplus;" : ""}</td><td>${line(r.value)}</td><td class="hx">${toHex(r.value)}</td><td class="cm">${r.label}</td></tr>`;
    });
    h += `<tr class="total"><td class="sym">=</td><td>${line(total)}</td><td class="hx k">${toHex(total)}</td><td class="cm">${totalLabel}</td></tr>`;
    return h + `</table></div>`;
  }

  function subWordTable(w) {
    let h = `<div class="scroll"><table class="data"><tr><th>Byte</th><th>Row (high nibble)</th><th>Column (low nibble)</th><th>S-box value</th><th></th></tr>`;
    w.forEach(b => {
      h += `<tr><td class="m">${hex2(b)}</td><td class="m">${(b >> 4).toString(16).toUpperCase()}</td><td class="m">${(b & 15).toString(16).toUpperCase()}</td><td class="m k">${hex2(SBOX[b])}</td>
        <td>${R.openBtn("sub", { mode: "byte", byte: hex2(b), dir: "fwd" }, "Show working")}</td></tr>`;
    });
    return h + `</table></div>`;
  }

  function renderWord() {
    const out = $("ke-word-out");
    if (!ks) { out.innerHTML = ""; return; }
    const i = +$("ke-word").value;
    const t = ks.trace[i];
    const Nk = ks.Nk;
    let h = `<p>Start with <span class="m">temp = w[${i - 1}] = ${toHex(t.temp)}</span>. Here i = ${i}, Nk = ${Nk}, and i mod Nk = ${i % Nk}.</p>`;
    if (t.kind === "rcon") {
      h += `<p><b>i mod Nk = 0</b>, so temp goes through RotWord, SubWord and an Rcon XOR.</p>`;
      h += `<h4>a. RotWord: move the first byte to the end</h4>
        <p class="m">[${t.temp.map(hex2).join(" ")}] &rarr; [${t.rot.map(hex2).join(" ")}]</p>`;
      h += `<h4>b. SubWord: replace each byte using the S-box</h4>${subWordTable(t.rot)}
        <p class="m">SubWord = ${toHex(t.sub)}</p>`;
      h += `<h4>c. XOR with Rcon[${t.rconIndex}]</h4>
        <p class="note">Rcon[j] = (RC[j], 00, 00, 00) where RC[1] = 01 and each next RC is the previous one times 02 in GF(2<sup>8</sup>). RC[${t.rconIndex}] = ${hex2(t.rcon[0])}.</p>
        ${wordXor([{ value: t.sub, label: "SubWord" }, { value: t.rcon, label: `Rcon[${t.rconIndex}]` }], t.afterRcon, "new temp")}`;
    } else if (t.kind === "sub") {
      h += `<p><b>AES-256 rule:</b> i mod 8 = 4, so temp goes through SubWord only (no RotWord, no Rcon).</p>
        ${subWordTable(t.temp)}<p class="m">SubWord = ${toHex(t.sub)}</p>`;
    } else {
      h += `<p>i mod Nk is not 0${Nk > 6 ? " and not 4" : ""}, so temp is used as it is.</p>`;
    }
    const temp = t.kind === "rcon" ? t.afterRcon : t.kind === "sub" ? t.sub : t.temp;
    h += `<h4>${t.kind === "plain" ? "a" : t.kind === "sub" ? "b" : "d"}. w[${i}] = w[${i - Nk}] &oplus; temp</h4>
      ${wordXor([{ value: t.prev, label: `w[${i - Nk}]` }, { value: temp, label: "temp" }], t.result, `w[${i}]`)}`;
    out.innerHTML = `<div class="inner" style="padding:0;display:grid;gap:12px">${h}</div>`;
  }

  function render() {
    const bits = +R.segVal("ke-bits");
    const v = VARIANTS[bits];
    const need = v.Nk * 4;
    const key = R.readHex("ke-key", need);
    if (!key) {
      R.showError("ke-err", `AES-${bits} needs a ${need}-byte key: ${need * 2} hex digits.`);
      $("ke-steps").innerHTML = ""; $("ke-word-step").hidden = true; ks = null;
      $("ke-out").textContent = " ";
      return;
    }
    R.showError("ke-err", "");
    ks = AES.keyExpansion(key, bits);
    const total = ks.words.length;
    $("ke-out").textContent = `${ks.Nr + 1} round keys`;

    const rconUsed = ks.trace.filter(t => t.kind === "rcon").map(t => t.rconIndex);
    let h = R.step(1, "Read the parameters for this variant",
      `<div class="scroll"><table class="data">
        <tr><td class="dim">Key length</td><td>Nk = <b>${ks.Nk}</b> words (${need} bytes, ${bits} bits)</td></tr>
        <tr><td class="dim">Rounds</td><td>Nr = <b>${ks.Nr}</b></td></tr>
        <tr><td class="dim">Words to produce</td><td>4 &times; (Nr + 1) = <b>${total}</b>, w[0] to w[${total - 1}]</td></tr>
        <tr><td class="dim">Round keys</td><td><b>${ks.Nr + 1}</b> keys of 4 words each</td></tr>
        <tr><td class="dim">Rcon values used</td><td class="m">${rconUsed.map(j => `RC[${j}]=${hex2(RCON[j])}`).join("&nbsp; ")}</td></tr>
      </table></div>`);

    h += R.step(2, `Copy the key into w[0] to w[${ks.Nk - 1}]`,
      `<p>Each word is 4 bytes of the key, in order.</p>
      <div class="scroll"><table class="data"><tr><th>i</th><th>w[i]</th><th>Key bytes</th></tr>
      ${ks.trace.slice(0, ks.Nk).map(t => `<tr><td class="m">${t.i}</td><td class="m k">${toHex(t.result)}</td><td class="m dim">${t.i * 4}&ndash;${t.i * 4 + 3}</td></tr>`).join("")}
      </table></div>`);

    let rows = "";
    for (const t of ks.trace.slice(ks.Nk)) {
      const cls = t.i % 4 === 0 ? ` class="round-start"` : "";
      rows += `<tr${cls}><td class="m">${t.i}</td><td class="m">${toHex(t.temp)}</td>`;
      rows += t.kind === "rcon" ? `<td class="m">${toHex(t.rot)}</td>` : dash;
      rows += t.kind !== "plain" ? `<td class="m">${toHex(t.sub)}</td>` : dash;
      rows += t.kind === "rcon" ? `<td class="m">${toHex(t.rcon)}</td><td class="m">${toHex(t.afterRcon)}</td>` : dash + dash;
      rows += `<td class="m">${toHex(t.prev)}</td><td class="m k">${toHex(t.result)}</td></tr>`;
    }
    h += R.step(3, `Generate w[${ks.Nk}] to w[${total - 1}]`,
      `<p>For each i: take <span class="m">temp = w[i&minus;1]</span>. If <span class="m">i mod ${ks.Nk} = 0</span>, apply RotWord, SubWord and XOR with Rcon[i/${ks.Nk}].${ks.Nk > 6 ? ` For AES-256 only, if <span class="m">i mod 8 = 4</span>, apply SubWord alone.` : ""} Then <span class="m">w[i] = w[i&minus;${ks.Nk}] &oplus; temp</span>.</p>
      <div class="scroll"><table class="data">
        <tr><th>i</th><th>temp = w[i&minus;1]</th><th>RotWord</th><th>SubWord</th><th>Rcon</th><th>&oplus; Rcon</th><th>w[i&minus;${ks.Nk}]</th><th>w[i]</th></tr>
        ${rows}
      </table></div>
      <p class="note">Pick any word in the last step to see its working byte by byte.</p>`);

    let rk = `<div class="scroll"><table class="data"><tr><th>Round</th><th>Words</th><th>Round key</th><th></th></tr>`;
    ks.roundKeys.forEach((k, r) => {
      rk += `<tr><td class="m">${r}</td><td class="m dim">w[${4 * r}]&ndash;w[${4 * r + 3}]</td><td class="m k">${toHex(k)}</td>
        <td>${R.openBtn("ark", { key: toHex(k) }, "Use in AddRoundKey")}</td></tr>`;
    });
    h += R.step(4, "Group the words into round keys", rk + `</table></div>`);
    $("ke-steps").innerHTML = h;

    const sel = $("ke-word");
    const keep = +sel.value;
    sel.innerHTML = ks.trace.slice(ks.Nk).map(t =>
      `<option value="${t.i}">w[${t.i}]${t.kind === "rcon" ? " (RotWord, SubWord, Rcon)" : t.kind === "sub" ? " (SubWord)" : ""}</option>`).join("");
    sel.value = keep >= ks.Nk && keep < total ? keep : ks.Nk;
    $("ke-word-step").hidden = false;
    renderWord();
  }

  App.register({
    id: "keys",
    group: "phase",
    title: "Key Expansion",
    blurb: "Expand a cipher key into its round keys. Every word w[i] is listed, and you can open any single word to see each byte of its working.",
    html: () => `
      <div class="panel">
        <div class="inputs">
          ${R.seg("ke-bits", "Variant", [["128", "AES-128"], ["192", "AES-192"], ["256", "AES-256"]], "192")}
          ${R.longField("ke-key", "Cipher key (hex)", EXAMPLES[192].key)}
          ${R.resultBox("ke-out", "Output")}
        </div>
        <div class="actions"><button type="button" class="btn" id="ke-example">Load FIPS-197 example key</button></div>
        <p class="error" id="ke-err" hidden></p>
      </div>
      <div class="steps">
        <div class="steps" id="ke-steps"></div>
        <article class="step" id="ke-word-step">
          <div class="step-head"><span class="step-no">5</span><h3>Work out one word in detail</h3></div>
          <div class="field"><label class="flabel" for="ke-word">Word</label><select id="ke-word"></select></div>
          <div id="ke-word-out"></div>
        </article>
      </div>`,
    init() {
      $("ke-bits").addEventListener("change", render);
      $("ke-key").addEventListener("input", render);
      $("ke-word").addEventListener("change", renderWord);
      $("ke-example").addEventListener("click", () => { $("ke-key").value = EXAMPLES[R.segVal("ke-bits")].key; render(); });
      render();
    },
    load(d) {
      if (d.bits) R.setSeg("ke-bits", d.bits);
      if (d.key) $("ke-key").value = d.key;
      render();
    },
  });
})();
