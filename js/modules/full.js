// Full cipher module: AES-128/192/256 encryption and decryption, round by round
(function () {
  "use strict";
  const { toHex, VARIANTS, EXAMPLES } = AES;
  const $ = id => document.getElementById(id);
  let last = null;

  // Where each operation's "Explain" button leads, pre-filled with that step's input
  function explain(st) {
    const state = toHex(st.input);
    switch (st.op) {
      case "SubBytes": return R.openBtn("sub", { mode: "state", state, dir: "fwd" }, "Explain this step");
      case "InvSubBytes": return R.openBtn("sub", { mode: "state", state, dir: "inv" }, "Explain this step");
      case "ShiftRows": return R.openBtn("shift", { state, dir: "fwd" }, "Explain this step");
      case "InvShiftRows": return R.openBtn("shift", { state, dir: "inv" }, "Explain this step");
      case "MixColumns": return R.openBtn("mix", { mode: "state", state, dir: "fwd" }, "Explain this step");
      case "InvMixColumns": return R.openBtn("mix", { mode: "state", state, dir: "inv" }, "Explain this step");
      default: return R.openBtn("ark", { state, key: toHex(st.key) }, "Explain this step");
    }
  }

  function opCard(st, keyIndex) {
    const flow = st.op === "AddRoundKey"
      ? `${R.grid(st.input, { cap: "State", small: true })}<span class="arrow">&oplus;</span>${R.grid(st.key, { cap: `Round key ${keyIndex}`, small: true })}<span class="arrow">=</span>${R.grid(st.output, { cap: "<b>Result</b>", small: true })}`
      : `${R.grid(st.input, { cap: "Before", small: true })}<span class="arrow">&rarr;</span>${R.grid(st.output, { cap: `<b>After ${st.op}</b>`, small: true })}`;
    return `<div class="op-card"><div class="op-head"><b>${st.op}</b>${explain(st)}</div><div class="flow">${flow}</div></div>`;
  }

  function render() {
    const enc = R.segVal("fc-mode") === "enc";
    const bits = +R.segVal("fc-bits");
    const v = VARIANTS[bits];
    $("fc-in-label").textContent = enc ? "Plaintext (16 bytes, hex)" : "Ciphertext (16 bytes, hex)";
    $("fc-out-label").textContent = enc ? "Ciphertext" : "Plaintext";
    const input = R.readHex("fc-in", 16);
    const key = R.readHex("fc-key", v.Nk * 4);
    if (!input || !key) {
      R.showError("fc-err", !input
        ? "The input block needs 16 bytes: 32 hex digits."
        : `AES-${bits} needs a ${v.Nk * 4}-byte key: ${v.Nk * 8} hex digits. Change the variant or the key.`);
      $("fc-out").textContent = " "; $("fc-steps").innerHTML = ""; last = null;
      return;
    }
    R.showError("fc-err", "");
    const res = enc ? AES.encrypt(input, key, bits) : AES.decrypt(input, key, bits);
    last = res;
    const ks = res.keySchedule;
    $("fc-out").textContent = toHex(res.output, " ");

    let rk = `<div class="scroll"><table class="data"><tr><th>Round key</th><th>Value</th></tr>`;
    ks.roundKeys.forEach((k, r) => { rk += `<tr><td class="m">${r}</td><td class="m">${toHex(k)}</td></tr>`; });
    let h = R.step(1, "Expand the key",
      `<p>AES-${bits} uses a ${v.Nk * 4}-byte key (Nk = ${ks.Nk}), runs <b>${ks.Nr} rounds</b>, and needs <b>${ks.Nr + 1} round keys</b>.${enc ? "" : " Decryption uses them in reverse order, from round key " + ks.Nr + " down to 0."}</p>
      ${rk}</table></div>
      <div class="actions">${R.openBtn("keys", { bits: String(bits), key: toHex(key) }, "Show full key expansion")}</div>`);

    h += R.step(2, `Load the ${enc ? "plaintext" : "ciphertext"} into the state`,
      `<p>The 16 bytes fill the 4&times;4 state column by column.</p>${R.grid(input, { cap: "Initial state" })}`);

    const opsList = steps => steps.map(s => s.op).join(" → ");
    let rounds = "";
    res.rounds.forEach((r, n) => {
      const keyIndex = enc ? r.index : r.keyIndex;
      const title = r.index === 0 ? "Round 0 (initial key)" : r.index === ks.Nr ? `Round ${r.index} (final)` : `Round ${r.index}`;
      const out = r.steps[r.steps.length - 1].output;
      rounds += `<details class="round"${n < 2 ? " open" : ""}><summary><h3>${title}</h3><span class="ops">${opsList(r.steps)}</span><span class="out">${toHex(out, " ")}</span></summary>
        <div class="round-body">${r.steps.map(st => opCard(st, st.op === "AddRoundKey" ? keyIndex : null)).join("")}</div></details>`;
    });
    const note = enc
      ? `The final round (${ks.Nr}) skips MixColumns.`
      : `This is the inverse cipher from FIPS-197: each round runs InvShiftRows, InvSubBytes, AddRoundKey, then InvMixColumns. The last round skips InvMixColumns.`;
    h += R.step(3, `Run the ${ks.Nr} rounds`,
      `<p>${note} Click a round to open or close it. Each step has an <b>Explain this step</b> button that opens it in its own module, filled in with this state.</p>
      <div class="actions"><button type="button" class="btn" id="fc-expand">Open all rounds</button><button type="button" class="btn" id="fc-collapse">Close all rounds</button></div>
      <div class="steps">${rounds}</div>`);

    const ex = EXAMPLES[bits];
    let check = "";
    if (toHex(key).toLowerCase() === ex.key && toHex(input).toLowerCase() === (enc ? ex.plain : ex.cipher)) {
      const want = enc ? ex.cipher : ex.plain;
      check = toHex(res.output).toLowerCase() === want
        ? `<p>This matches the FIPS-197 Appendix C test vector for AES-${bits}.</p>`
        : `<p class="error">This does not match the FIPS-197 test vector (${want}).</p>`;
    }
    h += R.step("&check;", enc ? "Ciphertext" : "Plaintext",
      `${R.grid(res.output, { cap: "Final state", hl: new Set([...Array(16).keys()]) })}
      <p>Read the state column by column: <span class="m k">${toHex(res.output, " ")}</span></p>${check}
      <p class="note">To check the result, click <b>Use result as input</b>. It switches to ${enc ? "decryption" : "encryption"} with the same key.</p>`, "check");
    $("fc-steps").innerHTML = h;
    $("fc-expand").addEventListener("click", () => $("fc-steps").querySelectorAll("details.round").forEach(d => { d.open = true; }));
    $("fc-collapse").addEventListener("click", () => $("fc-steps").querySelectorAll("details.round").forEach(d => { d.open = false; }));
  }

  function loadExample() {
    const bits = R.segVal("fc-bits");
    const ex = EXAMPLES[bits];
    $("fc-key").value = ex.key;
    $("fc-in").value = R.segVal("fc-mode") === "enc" ? ex.plain : ex.cipher;
    render();
  }

  App.register({
    id: "full",
    group: "cipher",
    title: "Encrypt / Decrypt",
    blurb: "Run the whole AES cipher on one 16-byte block with AES-128, AES-192 or AES-256. Every round shows the state before and after each step.",
    html: () => `
      <div class="panel">
        <div class="inputs">
          ${R.seg("fc-mode", "Operation", [["enc", "Encrypt"], ["dec", "Decrypt"]], "enc")}
          ${R.seg("fc-bits", "Variant", [["128", "AES-128"], ["192", "AES-192"], ["256", "AES-256"]], "192")}
        </div>
        <div class="inputs">
          <div class="field grow"><label class="flabel" for="fc-in"><span id="fc-in-label">Plaintext (16 bytes, hex)</span> <span class="count" id="fc-in-count"></span></label>
            <div class="hexin long"><input id="fc-in" value="${EXAMPLES[192].plain}" autocomplete="off" spellcheck="false"></div></div>
          ${R.longField("fc-key", "Key (hex)", EXAMPLES[192].key)}
        </div>
        <div class="inputs">
          <div class="result long"><span class="flabel" id="fc-out-label">Ciphertext</span><div class="val" id="fc-out">&nbsp;</div></div>
        </div>
        <div class="actions">
          <button type="button" class="btn" id="fc-example">Load FIPS-197 example</button>
          <button type="button" class="btn" id="fc-swap">Use result as input</button>
        </div>
        <p class="error" id="fc-err" hidden></p>
      </div>
      <div class="steps" id="fc-steps"></div>`,
    init() {
      $("fc-mode").addEventListener("change", render);
      $("fc-bits").addEventListener("change", render);
      ["fc-in", "fc-key"].forEach(id => $(id).addEventListener("input", render));
      $("fc-example").addEventListener("click", loadExample);
      $("fc-swap").addEventListener("click", () => {
        if (!last) return;
        $("fc-in").value = toHex(last.output).toLowerCase();
        R.setSeg("fc-mode", R.segVal("fc-mode") === "enc" ? "dec" : "enc");
        render();
      });
      render();
    },
  });
})();
