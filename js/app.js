// App shell: module registry, navigation bar, hash routing, and the
// "open this in another module" handoff used by the Explain buttons.
(function () {
  "use strict";

  const GROUPS = [
    { id: "cipher", label: "Full AES" },
    { id: "phase", label: "Single phases" },
  ];

  const App = {
    modules: [],
    byId: {},

    // module: { id, group, title, blurb, html(), init(), load?(data) }
    register(m) {
      this.modules.push(m);
      this.byId[m.id] = m;
    },

    show(id) {
      if (!this.byId[id]) id = this.modules[0].id;
      this.modules.forEach(m => {
        document.getElementById("mod-" + m.id).hidden = m.id !== id;
        const btn = document.getElementById("nav-" + m.id);
        if (m.id === id) btn.setAttribute("aria-current", "page");
        else btn.removeAttribute("aria-current");
      });
      try { history.replaceState(null, "", "#" + id); } catch (e) {}
      this.current = id;
    },

    open(id, data) {
      const m = this.byId[id];
      if (!m) return;
      if (data && m.load) m.load(data);
      this.show(id);
      document.getElementById("mod-" + id).scrollIntoView({ block: "start" });
    },

    start() {
      const nav = document.getElementById("nav");
      const host = document.getElementById("modules");
      nav.innerHTML = GROUPS.map(g => {
        const items = this.modules.filter(m => m.group === g.id)
          .map(m => `<button type="button" id="nav-${m.id}" data-nav="${m.id}">${m.title}</button>`).join("");
        return `<div class="nav-group"><span class="nav-label">${g.label}</span><div class="nav-items">${items}</div></div>`;
      }).join("");
      host.innerHTML = this.modules.map(m =>
        `<section class="module" id="mod-${m.id}" hidden>
          <div class="mod-head"><h2>${m.title}</h2><p>${m.blurb}</p></div>
          ${m.html()}
        </section>`).join("");

      // Segmented controls: keep data-value in sync and fire a change event
      document.addEventListener("click", e => {
        const b = e.target.closest(".seg button");
        if (!b) return;
        const seg = b.parentElement;
        R.setSeg(seg.id, b.dataset.v);
        seg.dispatchEvent(new Event("change", { bubbles: true }));
      });

      document.addEventListener("click", e => {
        const nb = e.target.closest("[data-nav]");
        if (nb) { this.show(nb.dataset.nav); return; }
        const ob = e.target.closest("[data-open]");
        if (ob) this.open(ob.dataset.open, { ...ob.dataset });
      });

      this.modules.forEach(m => m.init());
      const start = (location.hash || "").slice(1);
      this.show(this.byId[start] ? start : this.modules[0].id);
    },
  };

  window.App = App;
})();
