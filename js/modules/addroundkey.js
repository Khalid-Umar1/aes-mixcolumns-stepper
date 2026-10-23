// AddRoundKey module: state XOR round key, byte by byte
(function () {
  "use strict";
  const { hex2, toHex } = AES;
  const $ = id => document.getElementById(id);

  function render() {
    const s = R.readHex("ar-state", 16);
    const k = R.readHex("ar-key", 16);
    if (!s || !k) {
      R.showError("ar-err", `The ${!s ? "state" : "round key"} needs 16 bytes: 32 hex digits.`);
      $("ar-out").textContent = " "; $("ar-steps").innerHTML = "";
      return;
    }
    R.showError("ar-err", "");
    const out = AES.addRoundKey(s, k);
    $("ar-out").textContent = toHex(out, " ");

    let h = R.step(1, "Lay out the state and the round key",
      `<p>Both are filled column by column. Each byte of the state is XORed with the byte in the same position of the key. AddRoundKey is its own inverse, so it is the same in encryption and decryption.</p>
      <div class="flow">${R.grid(s, { cap: "State" })}<span class="arrow">&oplus;</span>${R.grid(k, { cap: "Round key" })}<span class="arrow">=</span>${R.grid(out, { cap: "<b>Result</b>", hl: new Set([...Array(16).keys()]) })}</div>`);

    let t = `<div class="scroll"><table class="data"><tr><th>(row, col)</th><th>State</th><th></th><th>Key</th><th></th><th>Result</th></tr>`;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      const i = r + 4 * c;
      t += `<tr><td class="m dim">(${r}, ${c})</td>
        <td class="m">${hex2(s[i])} &nbsp;${R.bits(s[i])}</td><td class="dim">&oplus;</td>
        <td class="m">${hex2(k[i])} &nbsp;${R.bits(k[i])}</td><td class="dim">=</td>
        <td class="m"><span class="k">${hex2(out[i])}</span> &nbsp;${R.bits(out[i])}</td></tr>`;
    }
    h += R.step(2, "XOR each byte in binary", `<p>XOR gives 1 where the two bits differ and 0 where they match.</p>${t}</table></div>`);
    $("ar-steps").innerHTML = h;
  }

  App.register({
    id: "ark",
    group: "phase",
    title: "AddRoundKey",
    blurb: "XOR the state with a 16-byte round key. Get round keys from Key Expansion, or type your own.",
    html: () => `
      <div class="panel">
        <div class="inputs">
          ${R.longField("ar-state", "State (16 bytes)", "046681e5e0cb199a48f8d37a2806264c")}
          ${R.longField("ar-key", "Round key (16 bytes)", "a0fafe1788542cb123a339392a6c7605")}
        </div>
        <div class="inputs">${R.resultBox("ar-out", "Result", true)}</div>
        <p class="error" id="ar-err" hidden></p>
      </div>
      <div class="steps" id="ar-steps"></div>`,
    init() {
      ["ar-state", "ar-key"].forEach(id => $(id).addEventListener("input", render));
      render();
    },
    load(d) {
      if (d.state) $("ar-state").value = d.state;
      if (d.key) $("ar-key").value = d.key;
      render();
    },
  });
})();
