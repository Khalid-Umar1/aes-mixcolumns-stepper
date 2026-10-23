// Shared HTML builders used by every module. Returns strings; modules insert them.
(function () {
  "use strict";
  const { hex2, toHex } = AES;

  function bits(n, w = 8, opts = {}) {
    let out = "";
    for (let i = w - 1; i >= 0; i--) {
      const b = (n >> i) & 1;
      let cls = b ? "on" : "off";
      if (opts.flag === i) cls = "flag";
      out += `<span class="bit ${cls}">${b}</span>`;
      if (i % 4 === 0 && i !== 0) out += `<span class="gap"></span>`;
    }
    return out;
  }

  function poly(n) {
    if (!n) return "0";
    const t = [];
    for (let i = 15; i >= 0; i--) {
      if ((n >> i) & 1) t.push(i === 0 ? "1" : i === 1 ? "x" : `x<sup>${i}</sup>`);
    }
    return t.join(" + ");
  }

  const wide = (v, w) => (w > 8 ? hex2(v >> 8) + hex2(v & 0xFF) : hex2(v));

  // rows: [{value, label}] stacked with XOR, total underneath
  function xorStack(rows, total, totalLabel, w = 8) {
    let h = `<div class="scroll"><table class="bits">`;
    rows.forEach((r, i) => {
      h += `<tr><td class="sym">${i ? "&oplus;" : ""}</td><td>${bits(r.value, w)}</td><td class="hx">${wide(r.value, w)}</td><td class="cm">${r.label}</td></tr>`;
    });
    h += `<tr class="total"><td class="sym">=</td><td>${bits(total, w)}</td><td class="hx k">${wide(total, w)}</td><td class="cm">${totalLabel}</td></tr>`;
    return h + `</table></div>`;
  }

  function step(no, title, body, extra = "") {
    return `<article class="step ${extra}"><div class="step-head"><span class="step-no">${no}</span><h3>${title}</h3></div>${body}</article>`;
  }

  // 4x4 state, column-major. opts: { cap, hl: Set, hot: Set, small }
  function grid(s, opts = {}) {
    let h = `<div class="grid-box">${opts.cap ? `<span class="cap">${opts.cap}</span>` : ""}<table class="state${opts.small ? " small" : ""}">`;
    for (let r = 0; r < 4; r++) {
      h += "<tr>";
      for (let c = 0; c < 4; c++) {
        const i = r + 4 * c;
        const cls = opts.hot && opts.hot.has(i) ? "hot" : opts.hl && opts.hl.has(i) ? "hl" : "";
        h += `<td class="${cls}">${hex2(s[i])}</td>`;
      }
      h += "</tr>";
    }
    return h + `</table></div>`;
  }

  const word = w => toHex(w);

  // ---------- Form controls ----------

  function byteField(id, label, value) {
    return `<div class="field"><label class="flabel" for="${id}">${label}</label>
      <div class="hexin"><span>0x</span><input id="${id}" maxlength="4" value="${value}" autocomplete="off" spellcheck="false"></div></div>`;
  }

  function longField(id, label, value, bytes) {
    return `<div class="field grow"><label class="flabel" for="${id}">${label} <span class="count" id="${id}-count"></span></label>
      <div class="hexin long"><input id="${id}" value="${value}" autocomplete="off" spellcheck="false" data-bytes="${bytes || ""}"></div></div>`;
  }

  function seg(id, label, options, selected) {
    const btns = options.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${v === selected}">${t}</button>`).join("");
    return `<div class="field">${label ? `<span class="flabel">${label}</span>` : ""}<div class="seg" id="${id}" data-value="${selected}" role="group" aria-label="${label || id}">${btns}</div></div>`;
  }

  function setSeg(id, v) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.value = v;
    el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === String(v)));
  }

  const segVal = id => document.getElementById(id).dataset.value;

  function resultBox(id, label, long) {
    return `<div class="result${long ? " long" : ""}"><span class="flabel">${label}</span><div class="val" id="${id}">&nbsp;</div></div>`;
  }

  // Reads a hex input, updates its byte counter, returns bytes or null
  function readHex(id, length) {
    const input = document.getElementById(id);
    const bytes = AES.parseHex(input.value);
    const count = document.getElementById(id + "-count");
    if (count) {
      const n = bytes ? bytes.length : null;
      count.textContent = n === null ? "(not valid hex)" : `${n} / ${length} bytes`;
      count.classList.toggle("bad", n !== length);
    }
    return bytes && bytes.length === length ? bytes : null;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  // Button that opens another module pre-filled. data is copied into data-* attributes.
  function openBtn(module, data, text) {
    const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(" ");
    return `<button type="button" class="btn" data-open="${module}" ${attrs}>${text}</button>`;
  }

  // ---------- GF(2^8) product derivation (shared by MixColumns and S-box checks) ----------

  const powLabel = p => hex2(1 << p);

  function xtimeCard(c, b, used) {
    const st = c.step;
    const prevLbl = `${powLabel(c.power - 1)}&middot;${hex2(b)}`;
    const lbl = `${powLabel(c.power)}&middot;${hex2(b)}`;
    let h = `<div class="xt"><div class="xt-title"><span class="m">${lbl} = 02&middot;(${prevLbl})</span>`;
    h += used ? `<span class="pill used">used</span>` : `<span class="pill unused">stepping stone</span>`;
    h += `</div><div class="scroll"><table class="bits">`;
    h += `<tr><td class="lbl">start</td><td>${bits(st.input, 8, { flag: st.overflow ? 7 : -1 })}</td><td class="hx">${hex2(st.input)}</td></tr>`;
    h += `<tr><td class="lbl">shift left</td><td>${bits(st.shifted)}</td><td class="hx">${hex2(st.shifted)}</td></tr>`;
    if (st.overflow) h += `<tr><td class="lbl hot">&oplus; 1B</td><td>${bits(0x1B)}</td><td class="hx">1B</td></tr>`;
    h += `<tr class="total"><td class="lbl">result</td><td>${bits(st.result)}</td><td class="hx k">${hex2(st.result)}</td></tr>`;
    h += `</table></div>`;
    h += st.overflow
      ? `<p class="note"><span class="hot">Bit 7 was 1</span>, so it overflowed out of the byte. XOR with 1B to reduce.</p>`
      : `<p class="note">Bit 7 was 0, so nothing overflowed. The shift alone is the answer.</p>`;
    return h + `</div>`;
  }

  // compact = true drops the binary intro and the polynomial cross-check
  function renderMul(a, b, compact = false) {
    const r = AES.mulTrace(a, b);
    const A = hex2(a), B = hex2(b);
    const parts = [];
    let n = 1;

    if (!compact) {
      parts.push(step(n++, "Write both bytes in binary and as polynomials",
        `<div class="scroll"><table class="data">
          <tr><td class="dim">Constant</td><td class="m k">${A}</td><td class="m">${bits(a)}</td><td class="m">${poly(a)}</td></tr>
          <tr><td class="dim">Byte</td><td class="m k">${B}</td><td class="m">${bits(b)}</td><td class="m">${poly(b)}</td></tr>
        </table></div>
        <p class="note">Bit <i>i</i> of a byte is the coefficient of x<sup><i>i</i></sup>. Multiplying by 02 means multiplying by x.</p>`));
    }

    let dec;
    if (a === 0) dec = `<p>The constant is 00, so the product is 00. There is nothing to compute.</p>`;
    else if (a === 1) dec = `<p>The constant is 01, the identity in GF(2<sup>8</sup>). The byte passes through unchanged: <span class="m">01&middot;${B} = <span class="k">${B}</span></span>.</p>`;
    else {
      const pieces = r.used.map(c => powLabel(c.power)).reverse();
      const prods = r.used.map(c => `(${powLabel(c.power)}&middot;${B})`).reverse();
      dec = pieces.length === 1
        ? `<p><span class="m">${A}</span> is already a single power of x (<span class="m">${poly(a)}</span>), so we only need to double the byte ${r.chain.length - 1} time${r.chain.length > 2 ? "s" : ""}.</p>`
        : `<p>Split the constant by its set bits: <span class="m">${A} = ${pieces.join(" &oplus; ")}</span> &nbsp;(${poly(a)}).</p>
           <p>Multiplication distributes over XOR, so <span class="m">${A}&middot;${B} = ${prods.join(" &oplus; ")}</span>.</p>`;
    }
    parts.push(step(n++, "Split the constant into powers of x", dec));
    if (a <= 1) return parts.join("");

    let chainHtml = "";
    if (r.chain.length > 1) {
      chainHtml = `<p>To multiply by 02 (xtime): shift the byte left one bit. If the bit that falls off the left was 1, XOR the result with <span class="m">1B</span>.</p>`;
      chainHtml += `<div class="scroll"><table class="bits"><tr><td class="lbl">01&middot;${B}</td><td>${bits(b)}</td><td class="hx">${B}</td><td class="cm">the byte itself</td></tr></table></div>`;
      chainHtml += `<div class="xt-list">${r.chain.slice(1).map(c => xtimeCard(c, b, (a >> c.power) & 1)).join("")}</div>`;
    }
    parts.push(step(n++, "Double the byte with xtime", chainHtml));

    const rows = r.used.slice().reverse().map(c => ({ value: c.value, label: `${powLabel(c.power)}&middot;${B}` }));
    const combine = rows.length === 1
      ? `<p>Only one term is needed, so the answer is <span class="m">${A}&middot;${B} = <span class="k">${hex2(r.result)}</span></span>.</p>`
      : `<p>XOR the terms picked out in step ${n - 2}, bit by bit.</p>${xorStack(rows, r.result, `${A}&middot;${B}`)}`;
    parts.push(step(n++, "XOR the needed terms together", combine));

    if (compact) return parts.join("");

    const p = AES.polyMul(a, b);
    const pRows = p.partials.slice().reverse().map(x => ({ value: x.value, label: `${B} &times; x<sup>${x.shift}</sup>` }));
    let ck = `<p>Multiply the polynomials without carries (XOR instead of add):</p>${xorStack(pRows, p.product, poly(p.product), 15)}`;
    if (p.reductions.length) {
      ck += `<p>The product has degree above 7, so divide by m(x) = 1 0001 1011. Each line cancels the highest bit above bit 7:</p>`;
      let t = `<div class="scroll"><table class="bits">`;
      p.reductions.forEach((rd, i) => {
        t += `<tr><td class="lbl">${i ? "" : "product"}</td><td>${bits(rd.before, 15, { flag: rd.degree })}</td><td class="cm">x<sup>${rd.degree}</sup> is set</td></tr>`;
        t += `<tr><td class="lbl hot">&oplus; m(x)&middot;x<sup>${rd.degree - 8}</sup></td><td>${bits(rd.sub, 15)}</td><td class="cm"></td></tr>`;
      });
      t += `<tr class="total"><td class="lbl">remainder</td><td>${bits(p.result, 15)}</td><td class="cm">${poly(p.result)}</td></tr></table></div>`;
      ck += t;
    } else {
      ck += `<p>The product already fits in 8 bits (degree 7 or less), so no reduction is needed.</p>`;
    }
    ck += `<p>Remainder <span class="m k">${hex2(p.result)}</span> ${p.result === r.result ? "matches the xtime result." : "does not match. Please report this input."}</p>`;
    parts.push(step("&check;", "Cross-check by polynomial division", ck, "check"));
    return parts.join("");
  }

  window.R = {
    bits, poly, xorStack, step, grid, word,
    byteField, longField, seg, setSeg, segVal, resultBox, readHex, showError, openBtn,
    renderMul,
  };
})();
