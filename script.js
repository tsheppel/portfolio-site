const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const yearEl = document.querySelector("#year");

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const NB_MAX_VIEW_H = () => Math.min(window.innerHeight * 0.72, 640);

function relayoutNotebookCarouselsIn(container) {
  container.querySelectorAll("[data-notebook-carousel]").forEach((root) => {
    root.dispatchEvent(new CustomEvent("nb:relayout", { bubbles: false }));
  });
}

function injectNotebookZoomUI(root) {
  const viewport = root.querySelector(".notebook-carousel-viewport");
  if (!viewport || viewport.dataset.zoomInjected === "true") return null;

  const slides = [...viewport.querySelectorAll(".notebook-slide")];
  if (!slides.length) return null;
  viewport.dataset.zoomInjected = "true";

  const scroll = document.createElement("div");
  scroll.className = "notebook-carousel-scroll";
  const wrap = document.createElement("div");
  wrap.className = "notebook-carousel-zoom-wrap";
  slides.forEach((img) => wrap.appendChild(img));
  scroll.appendChild(wrap);
  viewport.appendChild(scroll);

  const zoomBar = document.createElement("div");
  zoomBar.className = "notebook-carousel-zoom-bar";

  const hint = document.createElement("p");
  hint.className = "notebook-zoom-hint";
  hint.textContent =
    "Pan: drag inside the frame or use scrollbars. Zoom: +/− or Reset, or Ctrl (⌘ on Mac) + scroll wheel.";

  const controls = document.createElement("div");
  controls.className = "notebook-zoom-controls";

  const btnOut = document.createElement("button");
  btnOut.type = "button";
  btnOut.className = "btn btn-ghost notebook-zoom-out";
  btnOut.setAttribute("aria-label", "Zoom out");
  btnOut.textContent = "−";

  const pct = document.createElement("span");
  pct.className = "notebook-zoom-pct";
  pct.setAttribute("aria-live", "polite");

  const btnIn = document.createElement("button");
  btnIn.type = "button";
  btnIn.className = "btn btn-ghost notebook-zoom-in";
  btnIn.setAttribute("aria-label", "Zoom in");
  btnIn.textContent = "+";

  const btnReset = document.createElement("button");
  btnReset.type = "button";
  btnReset.className = "btn btn-ghost notebook-zoom-reset";
  btnReset.setAttribute("aria-label", "Reset zoom");
  btnReset.textContent = "Reset";

  controls.append(btnOut, pct, btnIn, btnReset);
  zoomBar.append(hint, controls);
  viewport.insertAdjacentElement("afterend", zoomBar);

  return { scroll, pct, btnIn, btnOut, btnReset };
}

function initNotebookCarousels() {
  document.querySelectorAll("[data-notebook-carousel]").forEach((root) => {
    const zoomUi = injectNotebookZoomUI(root);
    const slides = [...root.querySelectorAll(".notebook-slide")];
    if (!slides.length) return;

    const scroll = root.querySelector(".notebook-carousel-scroll");
    const viewport = root.querySelector(".notebook-carousel-viewport");
    const prevBtn = root.querySelector(".notebook-carousel-prev");
    const nextBtn = root.querySelector(".notebook-carousel-next");
    const currentEl = root.querySelector(".notebook-carousel-current");
    const dotsWrap = root.querySelector(".notebook-carousel-dots");
    const captionEl = root.querySelector(".notebook-carousel-caption");
    const pctEl = zoomUi?.pct;

    let index = 0;
    let zoomLevel = 1;
    const ZOOM_MIN = 1;
    const ZOOM_MAX = 4;
    const ZOOM_STEP = 0.25;

    const totalEl = root.querySelector(".notebook-carousel-total");
    if (totalEl) {
      totalEl.textContent = String(slides.length);
    }

    function updateZoomLabel() {
      if (pctEl) {
        pctEl.textContent = `${Math.round(zoomLevel * 100)}%`;
      }
      if (scroll) {
        scroll.classList.toggle("is-zoomed", zoomLevel > 1);
      }
    }

    function layoutActiveSlide() {
      if (!scroll) return;
      const active = slides[index];
      if (!active) return;

      const clearInactive = () => {
        slides.forEach((img, i) => {
          if (i !== index) {
            img.style.width = "";
            img.style.height = "";
          }
        });
      };

      const apply = () => {
        const nw = active.naturalWidth;
        const nh = active.naturalHeight;
        if (!nw || !nh) return;

        const pad = 16;
        const cw = scroll.clientWidth;
        if (cw < 16) {
          slides.forEach((img) => {
            img.style.width = "";
            img.style.height = "";
          });
          return;
        }

        const availW = Math.max(1, cw - pad);
        const availH = Math.max(1, NB_MAX_VIEW_H() - pad);
        const fit = Math.min(availW / nw, availH / nh, 1);
        const w = Math.round(nw * fit * zoomLevel);
        const h = Math.round(nh * fit * zoomLevel);
        active.style.width = `${w}px`;
        active.style.height = `${h}px`;
        clearInactive();
      };

      if (!active.complete || !active.naturalWidth) {
        active.addEventListener("load", apply, { once: true });
        return;
      }
      apply();
    }

    function setZoom(next) {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
      zoomLevel = Math.round(z * 100) / 100;
      updateZoomLabel();
      layoutActiveSlide();
    }

    function show(nextIndex) {
      const n = slides.length;
      index = ((nextIndex % n) + n) % n;
      zoomLevel = 1;
      if (scroll) {
        scroll.scrollTop = 0;
        scroll.scrollLeft = 0;
      }
      slides.forEach((img, i) => {
        img.classList.toggle("is-active", i === index);
      });
      if (currentEl) {
        currentEl.textContent = String(index + 1);
      }
      if (captionEl) {
        const cap = slides[index]?.getAttribute("data-slide-caption") ?? "";
        captionEl.textContent = cap;
      }
      if (dotsWrap) {
        dotsWrap.querySelectorAll(".notebook-carousel-dot").forEach((dot, i) => {
          dot.classList.toggle("is-active", i === index);
          if (i === index) {
            dot.setAttribute("aria-current", "true");
          } else {
            dot.removeAttribute("aria-current");
          }
        });
      }
      updateZoomLabel();
      layoutActiveSlide();
    }

    if (dotsWrap) {
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "notebook-carousel-dot";
        dot.setAttribute("aria-label", `Show figure ${i + 1} of ${slides.length}`);
        dot.addEventListener("click", () => show(i));
        dotsWrap.appendChild(dot);
      });
    }

    prevBtn?.addEventListener("click", () => show(index - 1));
    nextBtn?.addEventListener("click", () => show(index + 1));

    zoomUi?.btnIn.addEventListener("click", () => setZoom(zoomLevel + ZOOM_STEP));
    zoomUi?.btnOut.addEventListener("click", () => setZoom(zoomLevel - ZOOM_STEP));
    zoomUi?.btnReset.addEventListener("click", () => {
      zoomLevel = 1;
      if (scroll) {
        scroll.scrollTop = 0;
        scroll.scrollLeft = 0;
      }
      updateZoomLabel();
      layoutActiveSlide();
    });

    if (scroll) {
      scroll.addEventListener(
        "wheel",
        (e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
          setZoom(zoomLevel + delta);
        },
        { passive: false }
      );

      let drag = false;
      let sx = 0;
      let sy = 0;
      let sl = 0;
      let st = 0;

      scroll.addEventListener("mousedown", (e) => {
        if (zoomLevel <= 1) return;
        if (e.button !== 0) return;
        const t = e.target;
        if (t instanceof HTMLElement && t.closest("a, button")) return;
        drag = true;
        sx = e.clientX;
        sy = e.clientY;
        sl = scroll.scrollLeft;
        st = scroll.scrollTop;
        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {
        if (!drag) return;
        scroll.scrollLeft = sl - (e.clientX - sx);
        scroll.scrollTop = st - (e.clientY - sy);
      });

      window.addEventListener("mouseup", () => {
        drag = false;
      });

      window.addEventListener("mouseleave", () => {
        drag = false;
      });
    }

    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        show(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        show(index + 1);
      }
    });

    slides.forEach((img) => {
      img.addEventListener("dragstart", (e) => e.preventDefault());
    });

    root.addEventListener("nb:relayout", () => {
      layoutActiveSlide();
    });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => layoutActiveSlide(), 120);
    });

    show(0);
  });
}

initNotebookCarousels();

const OFFICE_ONLINE_EMBED = "https://view.officeapps.live.com/op/embed.aspx?src=";

function isLikelyUnreachableForOfficeViewer() {
  const href = window.location.href;
  if (href.startsWith("file:")) return true;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".local")
  );
}

async function pdfPreviewReachable(pdfAbs) {
  try {
    let r = await fetch(pdfAbs, { method: "HEAD" });
    if (r.ok) return true;
    if (r.status === 405) {
      r = await fetch(pdfAbs, { headers: { Range: "bytes=0-0" } });
      return r.ok || r.status === 206;
    }
  } catch {
    return false;
  }
  return false;
}

function resetDeckPreviewWarnings(panel) {
  panel.querySelectorAll("[data-deck-warn]").forEach((el) => {
    el.hidden = true;
  });
}

function setDeckPreviewWarnings(panel, { fileProtocol, showLocalOfficeHint }) {
  resetDeckPreviewWarnings(panel);
  if (fileProtocol) {
    const w = panel.querySelector('[data-deck-warn="file"]');
    if (w) w.hidden = false;
    return;
  }
  if (showLocalOfficeHint) {
    const w = panel.querySelector('[data-deck-warn="local"]');
    if (w) w.hidden = false;
  }
}

async function activateSingleDeckPreviewIframe(iframe, pageHref) {
  if (iframe.dataset.previewReady === "1") return { officeFallback: false };

  const pdfRel = iframe.getAttribute("data-deck-pdf");
  const officeRel =
    iframe.getAttribute("data-deck-pptx") ||
    iframe.getAttribute("data-deck-docx") ||
    iframe.getAttribute("data-deck-office");

  if (pdfRel) {
    try {
      const pdfAbs = new URL(pdfRel, pageHref).href;
      if (await pdfPreviewReachable(pdfAbs)) {
        iframe.src = `${pdfAbs}#view=FitH`;
        iframe.dataset.previewReady = "1";
        return { officeFallback: false };
      }
    } catch {
      /* ignore */
    }
  }

  if (!officeRel) {
    iframe.dataset.previewReady = "1";
    return { officeFallback: false };
  }

  let officeAbs;
  try {
    officeAbs = new URL(officeRel, pageHref).href;
  } catch {
    iframe.dataset.previewReady = "1";
    return { officeFallback: false };
  }

  iframe.src = OFFICE_ONLINE_EMBED + encodeURIComponent(officeAbs);
  iframe.dataset.previewReady = "1";
  return { officeFallback: true };
}

async function activateDeckPreviewIn(panel) {
  const iframes = panel.querySelectorAll("iframe[data-deck-preview]");
  const pageHref = window.location.href;

  if (pageHref.startsWith("file:")) {
    setDeckPreviewWarnings(panel, { fileProtocol: true, showLocalOfficeHint: false });
    iframes.forEach((ifr) => {
      ifr.dataset.previewReady = "1";
    });
    return;
  }

  resetDeckPreviewWarnings(panel);

  let anyOfficeFallback = false;
  for (const iframe of iframes) {
    const { officeFallback } = await activateSingleDeckPreviewIframe(iframe, pageHref);
    if (officeFallback) anyOfficeFallback = true;
  }

  const local = isLikelyUnreachableForOfficeViewer();
  if (local && anyOfficeFallback) {
    setDeckPreviewWarnings(panel, { fileProtocol: false, showLocalOfficeHint: true });
  }
}

function initAnalyticsExpandable() {
  document.querySelectorAll("[data-analytics-expandable]").forEach((card) => {
    const btn = card.querySelector(".analytics-toggle");
    const panel = card.querySelector(".analytics-expandable-body");
    if (!btn || !panel) return;

    const sync = (open) => {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Minimize" : "Expand";
      if (open) {
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-ghost");
        void activateDeckPreviewIn(panel);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            relayoutNotebookCarouselsIn(panel);
          });
        });
      } else {
        btn.classList.add("btn-primary");
        btn.classList.remove("btn-ghost");
      }
    };

    sync(false);

    btn.addEventListener("click", () => {
      sync(panel.hidden);
    });
  });
}

initAnalyticsExpandable();
