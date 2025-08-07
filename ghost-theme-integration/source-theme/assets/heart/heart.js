/* applause-button.js — v1.1.0 (single-SVG version) */
(() => {
  /* ---------- helpers ---------- */
  const API_DEFAULT = "/applause";
  const VERSION     = "heart-1.1.0";

  const pageURL = () => location.origin + location.pathname + location.search;
  const join    = (base, path) => `${String(base || "").replace(/\/+$/, "")}${path}`;

  const buildURL = (apiBase, endpoint, url) => {
    const u = new URL(join(apiBase, endpoint), location.origin);
    u.searchParams.set("url", url);
    return u.toString();
  };

  const toggleClass = (el, cls) => {
    el.classList.remove(cls);
    /* force reflow to restart CSS animations */ void el.offsetWidth;
    el.classList.add(cls);
  };

  const formatClaps = n => Number(n || 0).toLocaleString("en");

  async function getMemberToken() {
    try {
      const r = await fetch("/members/api/session", { credentials: "same-origin" });
      if (r.status === 204) return null;                              /* not logged in  */
      if (r.status === 200) {                                         /* Ghost v6 token */
        const token = (await r.text()).trim();
        return token.split(".").length === 3 ? token : null;          /* basic JWT test */
      }
    } catch (err) {
      console.error("Error fetching member token:", err);
    }
    return null;
  }

  const getClaps = async (api, url, token) => {
    const r   = await fetch(buildURL(api, "/get-claps", url),
                            { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const txt = await r.text().catch(() => "0");
    return { count: Number(txt || 0), has: r.headers.get("x-has-clapped") === "1" };
  };

  const updateClaps = async (api, url, token) => {
    const r   = await fetch(buildURL(api, "/update-claps", url), {
      method : "POST",
      headers: {
        "Content-Type": "text/plain",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(`1,${VERSION}`)
    });
    if (r.status === 401) throw new Error("auth");                    /* not signed in  */
    const txt = await r.text().catch(() => "0");
    return { count: Number(txt || 0), has: r.headers.get("x-has-clapped") === "1" };
  };

  /* ---------- web component ---------- */
  class ApplauseButton extends HTMLElement {
    connectedCallback() {
      if (this._connected) return;

      this.classList.add("loading");

      /* minimal DOM, now with ONE inline SVG */
      this.innerHTML = `
        <div class="style-root">
          <button type="button" aria-label="applaud post" class="heart-button">
            <div class="heart-wrapper">
              <svg class="heart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" aria-hidden="true">
                <path d="m1091.1 654.25-491.14 492.21-492.92-492.21c-325.88-325.88 166.33-817.73 492.92-491.85 328.38-329.45 820.94 162.76 491.14 491.85z"/>
              </svg>
            </div>
            <div class="clap-count visually-hidden" aria-live="polite" aria-label="clap count">0</div>
          </button>
        </div>
      `;

      /* cache references */
      this._styleRoot   = this.querySelector(".style-root");
      this._countEl     = this.querySelector(".clap-count");
      this._clapBtn     = this.querySelector("button");

      /* attributes / defaults */
      this.api     = (this.getAttribute("api") || API_DEFAULT).replace(/\/+$/, "");
      this.url     = this.getAttribute("url") || pageURL();
      this.token   = null;
      this._hasClapped       = false;
      this._cachedClapCount  = 0;

      /* initial load */
      (async () => {
        this.token = await getMemberToken();

        const { count, has } =
          await getClaps(this.api, this.url, this.token).catch(err => {
            console.error("Error fetching claps:", err);
            return { count: 0, has: false };
          });

        this.classList.remove("loading");
        this._countEl.textContent = formatClaps(count);
        this._countEl.classList.remove("visually-hidden");
        this._cachedClapCount = count;
        this._hasClapped      = has;
        this._updateButtonState(has);
        if (has) this.classList.add("clapped");
      })();

      /* click handler */
      this._clapBtn.addEventListener("click", async (e) => {
        e.preventDefault(); e.stopPropagation();

        if (!this.token) {
          (document.getElementById("applause-portal-signin") || {}).click?.();
          location.hash = "#/portal/signin";
          return;
        }

        /* optimistic UI */
        this._hasClapped ? this.classList.remove("clapped")
                         : this.classList.add("clapped");
        if (!this._hasClapped) toggleClass(this, "clap");

        try {
          const { count, has } = await updateClaps(this.api, this.url, this.token);
          this._cachedClapCount       = count;
          this._hasClapped            = has;
          this._countEl.textContent   = formatClaps(count);
          this._updateButtonState(has);
          this.classList.toggle("clapped", has);
        } catch (err) {
          if (err.message === "auth") {
            (document.getElementById("applause-portal-signin") || {}).click?.();
            location.hash = "#/portal/signin";
          } else {
            console.error("Error updating claps:", err);
            /* rollback UI on error */
            this.classList.toggle("clapped", this._hasClapped);
          }
        }
      });

      this._connected = true;
    }

    _updateButtonState(has) {
      if (!this._clapBtn) return;
      if (has) {
        this._clapBtn.setAttribute("aria-label", "remove applause");
        this._clapBtn.setAttribute("title",       "Click to remove your applause");
      } else {
        this._clapBtn.setAttribute("aria-label", "applaud post");
        this._clapBtn.setAttribute("title",       "Click to applaud this post");
      }
    }
  }

  /* define once */
  if (!customElements.get("applause-button"))
    customElements.define("applause-button", ApplauseButton);

  /* hidden portal trigger for non-members (if not already present) */
  if (!document.getElementById("applause-portal-signin")) {
    const a = Object.assign(document.createElement("a"), {
      id: "applause-portal-signin",
      hidden: true,
      dataset: { portal: "signin" }
    });
    document.body.appendChild(a);
  }
})();