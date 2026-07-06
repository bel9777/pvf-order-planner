/* Park View Farm Order Planner — embed loader.
   Paste this on a GrazeCart custom page:

     <div id="pvf-order-planner"></div>
     <script src="https://bel9777.github.io/pvf-order-planner/embed.js" defer></script>

   It pulls the planner's markup, styles, and logic from GitHub Pages, so
   every update ships from the repo without touching GrazeCart again.
   Same-origin hosting is what makes the one-click "Add everything to my
   cart" button possible. */

(async function () {
  const BASE = "https://bel9777.github.io/pvf-order-planner/";
  const mount = document.getElementById("pvf-order-planner");
  if (!mount || mount.dataset.loaded) return;
  mount.dataset.loaded = "1";
  document.body.classList.add("pvf-embedded"); // scope standalone-only styles off

  if (!document.querySelector(`link[href="${BASE}style.css"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = BASE + "style.css";
    document.head.appendChild(link);
  }

  try {
    const resp = await fetch(BASE + "index.html", { cache: "no-cache" });
    const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
    // The site provides its own header/footer; embed the planner body only.
    const intro = doc.querySelector(".masthead__sub");
    const main = doc.querySelector("main#planner");
    mount.innerHTML = "";
    if (intro) {
      const p = document.createElement("p");
      p.className = "masthead__sub";
      p.style.cssText = "max-width:640px;margin:8px auto 0;padding:0 16px;text-align:center;";
      p.textContent = intro.textContent;
      mount.appendChild(p);
    }
    if (!main) throw new Error("planner markup not found");
    mount.appendChild(main);

    const script = document.createElement("script");
    script.src = BASE + "app.js";
    document.body.appendChild(script);
  } catch (e) {
    mount.innerHTML = `<p style="text-align:center;padding:24px;">
      The planner couldn't load. <a href="${BASE}">Open it here instead</a>.</p>`;
  }
})();
