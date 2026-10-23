// ShiftRows / InvShiftRows module
(function () {
  "use strict";
  const { hex2, toHex } = AES;
  const $ = id => document.getElementById(id);
  const row = (s, r) => [0, 1, 2, 3].map(c => s[r + 4 * c]);

  function render() {
    const inv = R.segVal("sr-dir") === "inv";
    const s = R.readHex("sr-state", 16);
    if (!s) {
      R.showError("sr-err", "The state needs 16 bytes: 32 hex digits.");
      $("sr-out").textContent = " "; $("sr-steps").innerHTML = "";
      return;
    }
    R.showError("sr-err", "");
    const out = inv ? AES.invShiftRows(s) : AES.shiftRows(s);
    $("sr-out").textContent = toHex(out, " ");

    let order = `<div class="scroll"><table class="data"><tr><th>Byte number</th>${s.map((_, i) => `<th>${i}</th>`).join("")}</tr>
      <tr><td class="dim">Value</td>${s.map(b => `<td class="m">${hex2(b)}</td>`).join("")}</tr>
      <tr><td class="dim">(row, col)</td>${s.map((_, i) => `<td class="m dim">${i % 4},${Math.floor(i / 4)}</td>`).join("")}</tr></table></div>`;
    let h = R.step(1, "Lay the 16 bytes into the state, column by column",
      `<p>Byte k goes to row <span class="m">k mod 4</span>, column <span class="m">&lfloor;k / 4&rfloor;</span>. The first 4 bytes fill column 0, the next 4 fill column 1, and so on.</p>
      ${order}${R.grid(s, { cap: "Input state" })}`);

    let t = `<div class="scroll"><table class="data"><tr><th>Row</th><th>Before</th><th>Shift</th><th>After</th></tr>`;
    for (let r = 0; r < 4; r++) {
      const how = r === 0 ? "none" : `${inv ? "right" : "left"} by ${r}`;
      t += `<tr><td class="m">${r}</td><td class="m">${row(s, r).map(hex2).join(" ")}</td><td>${how}</td><td class="m k">${row(out, r).map(hex2).join(" ")}</td></tr>`;
    }
    h += R.step(2, `Rotate each row ${inv ? "right" : "left"} by its row number`,
      `<p>Row 0 stays. Row 1 moves 1 place, row 2 moves 2 places, row 3 moves 3 places, wrapping around the end. Bytes never change value, only position.</p>${t}</table></div>`);

    h += R.step(3, "Result",
      `<div class="flow">${R.grid(s, { cap: "Before" })}<span class="arrow">&rarr;</span>${R.grid(out, { cap: inv ? "After InvShiftRows" : "After ShiftRows", hl: new Set([1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15]) })}</div>
      <p>Read back column by column: <span class="m k">${toHex(out, " ")}</span></p>`);
    $("sr-steps").innerHTML = h;
  }

  App.register({
    id: "shift",
    group: "phase",
    title: "ShiftRows",
    blurb: "Rotate rows 1, 2 and 3 of the state by 1, 2 and 3 bytes. InvShiftRows rotates the other way.",
    html: () => `
      <div class="panel">
        <div class="inputs">
          ${R.seg("sr-dir", "Direction", [["fwd", "ShiftRows"], ["inv", "InvShiftRows"]], "fwd")}
        </div>
        <div class="inputs">
          ${R.longField("sr-state", "State (16 bytes, column by column)", "d42711aee0bf98f1b8b45de51e415230")}
          ${R.resultBox("sr-out", "Result", true)}
        </div>
        <p class="error" id="sr-err" hidden></p>
      </div>
      <div class="steps" id="sr-steps"></div>`,
    init() {
      $("sr-dir").addEventListener("change", render);
      $("sr-state").addEventListener("input", render);
      render();
    },
    load(d) {
      if (d.dir) R.setSeg("sr-dir", d.dir);
      if (d.state) $("sr-state").value = d.state;
      render();
    },
  });
})();
