/* KatLearn transition motion — inspired by a four-tile scatter + progress-ring sequence.
   This is a page-navigation animation, not an OTP or authentication screen. */
(() => {
  "use strict";

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (window.__katLearnTransitionInstalled) return;
  window.__katLearnTransitionInstalled = true;

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const style = document.createElement("style");
  style.textContent = `
    .klm-overlay{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:hidden;background:radial-gradient(ellipse at 50% 35%,rgba(232,239,255,.96),rgba(247,248,255,.985) 53%,rgba(239,246,255,.99));color:#17233d;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;opacity:0;transition:opacity .22s ease;isolation:isolate}
    .klm-overlay.klm-visible{opacity:1}
    .klm-overlay:before,.klm-overlay:after{content:"";position:absolute;z-index:-1;width:min(70vw,540px);aspect-ratio:1;border-radius:50%;filter:blur(2px);pointer-events:none}
    .klm-overlay:before{background:radial-gradient(circle,rgba(137,159,255,.22),rgba(137,159,255,0) 70%);left:-22%;top:-29%}
    .klm-overlay:after{background:radial-gradient(circle,rgba(95,224,208,.19),rgba(95,224,208,0) 70%);right:-25%;bottom:-32%}
    .klm-content{position:relative;width:min(88vw,370px);min-height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
    .klm-tiles{position:absolute;inset:0;pointer-events:none}
    .klm-tile{position:absolute;left:50%;top:50%;width:25px;height:25px;margin:-13px 0 0 -13px;border-radius:8px;opacity:0;box-shadow:0 9px 22px rgba(86,103,177,.2);animation:klm-scatter .72s cubic-bezier(.2,.82,.18,1) forwards;will-change:transform,opacity}
    .klm-tile:nth-child(1){--dx:calc(-50vw + 34px);--dy:calc(-50vh + 34px);--rot:-38deg;background:linear-gradient(135deg,#8c7bff,#5f8cff);animation-delay:.02s}
    .klm-tile:nth-child(2){--dx:calc(50vw - 48px);--dy:calc(-50vh + 34px);--rot:42deg;background:linear-gradient(135deg,#54d6c4,#73a9ff);animation-delay:.06s}
    .klm-tile:nth-child(3){--dx:calc(-50vw + 34px);--dy:calc(50vh - 48px);--rot:32deg;background:linear-gradient(135deg,#ffbd8a,#ff8eb2);animation-delay:.1s}
    .klm-tile:nth-child(4){--dx:calc(50vw - 48px);--dy:calc(50vh - 48px);--rot:-45deg;background:linear-gradient(135deg,#7da8ff,#9a8bff);animation-delay:.14s}
    @keyframes klm-scatter{0%{opacity:0;transform:translate3d(0,8px,0) scale(.45) rotate(0)}18%{opacity:1;transform:translate3d(0,0,0) scale(1) rotate(0)}75%{opacity:.9}100%{opacity:0;transform:translate3d(var(--dx),var(--dy),0) scale(.58) rotate(var(--rot))}}
    .klm-brand{display:flex;align-items:center;gap:8px;margin-bottom:24px;color:#65718c;font-size:10px;font-weight:800;letter-spacing:.19em;text-transform:uppercase}
    .klm-brand-mark{display:grid;place-items:center;width:25px;height:25px;border-radius:9px;color:#fff;font-size:13px;letter-spacing:0;background:linear-gradient(135deg,#8875ff,#65a5ff);box-shadow:0 5px 14px rgba(100,119,229,.26)}
    .klm-title{margin:0;color:#1b2744;font-size:clamp(22px,5vw,27px);font-weight:800;letter-spacing:-.045em;line-height:1.2}
    .klm-subtitle{min-height:20px;margin:9px 0 0;color:#73809b;font-size:13px;line-height:1.5}
    .klm-progress-wrap{position:relative;display:none;width:88px;height:88px;margin:0 0 20px;place-items:center}
    .klm-progress-wrap.klm-active{display:grid;animation:klm-pop .34s cubic-bezier(.2,.8,.25,1) both}
    .klm-ring-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;transform:rotate(-90deg)}
    .klm-track{fill:none;stroke:rgba(137,151,190,.18);stroke-width:6}
    .klm-ring{fill:none;stroke:url(#klm-gradient);stroke-width:6;stroke-linecap:round;stroke-dasharray:263.9;stroke-dashoffset:263.9;filter:drop-shadow(0 3px 5px rgba(111,128,230,.18));transition:stroke-dashoffset .08s linear}
    .klm-percent{position:relative;color:#37466c;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
    .klm-check{display:none;position:relative;width:58px;height:58px;place-items:center;border-radius:50%;background:linear-gradient(135deg,#32c8a6,#66d8bb);box-shadow:0 10px 26px rgba(48,194,158,.25);color:white;animation:klm-pop .38s cubic-bezier(.2,.8,.25,1) both}
    .klm-check svg{width:30px;height:30px;stroke:currentColor;stroke-width:3.4;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:42;stroke-dashoffset:42;animation:klm-draw .38s .08s ease forwards}
    .klm-overlay.klm-done .klm-progress-wrap{display:none}
    .klm-overlay.klm-done .klm-check{display:grid}
    .klm-overlay.klm-done .klm-title{animation:klm-title-in .3s ease both}
    .klm-ready{display:none;margin-top:14px;padding:5px 10px;border-radius:999px;background:rgba(46,190,153,.1);color:#219c7f;font-size:9px;font-weight:900;letter-spacing:.17em}
    .klm-overlay.klm-done .klm-ready{display:inline-flex;animation:klm-pop .25s ease both}
    @keyframes klm-pop{from{opacity:0;transform:translateY(7px) scale(.86)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes klm-draw{to{stroke-dashoffset:0}}
    @keyframes klm-title-in{from{opacity:.25;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
    @media(prefers-color-scheme:dark){.klm-overlay{background:radial-gradient(ellipse at 50% 35%,rgba(36,46,82,.985),rgba(14,19,37,.99) 62%);color:#eef2ff}.klm-title{color:#f4f6ff}.klm-subtitle,.klm-brand{color:#a7b3d4}.klm-percent{color:#e0e7ff}.klm-track{stroke:rgba(174,190,235,.16)}}
    @media(prefers-reduced-motion:reduce){.klm-overlay,.klm-overlay *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);

  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "klm-overlay";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="klm-content">
        <div class="klm-tiles" aria-hidden="true">
          <span class="klm-tile"></span><span class="klm-tile"></span>
          <span class="klm-tile"></span><span class="klm-tile"></span>
        </div>
        <div class="klm-brand"><span class="klm-brand-mark">K</span><span>KatLearn · Your Study Zone</span></div>
        <div class="klm-progress-wrap" aria-hidden="true">
          <svg class="klm-ring-svg" viewBox="0 0 100 100">
            <defs><linearGradient id="klm-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b78ff"/><stop offset="52%" stop-color="#659bff"/><stop offset="100%" stop-color="#46d6b9"/></linearGradient></defs>
            <circle class="klm-track" cx="50" cy="50" r="42"></circle>
            <circle class="klm-ring" cx="50" cy="50" r="42"></circle>
          </svg>
          <span class="klm-percent">0%</span>
        </div>
        <div class="klm-check" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m7 16 6 6L25 9"/></svg></div>
        <h2 class="klm-title">Đang chuyển trang</h2>
        <p class="klm-subtitle">KatLearn đang chuẩn bị nội dung tiếp theo.</p>
        <span class="klm-ready">READY TO LEARN</span>
      </div>`;
    return overlay;
  }

  async function playTransition(destination) {
    if (window.__katLearnTransitionRunning) return;
    window.__katLearnTransitionRunning = true;
    const overlay = createOverlay();
    document.body.appendChild(overlay);
    // Force a first paint so the overlay fades in before the tiles scatter.
    void overlay.offsetHeight;
    requestAnimationFrame(() => overlay.classList.add("klm-visible"));

    await wait(690);
    overlay.querySelector(".klm-tiles").style.display = "none";
    overlay.querySelector(".klm-progress-wrap").classList.add("klm-active");
    const title = overlay.querySelector(".klm-title");
    const subtitle = overlay.querySelector(".klm-subtitle");
    title.textContent = "Đang chuẩn bị";
    subtitle.textContent = "Đang mở trang bạn vừa chọn…";

    const ring = overlay.querySelector(".klm-ring");
    const percent = overlay.querySelector(".klm-percent");
    const duration = 940;
    const start = performance.now();
    await new Promise((resolve) => {
      function step(now) {
        const raw = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - raw, 3);
        const value = Math.min(100, Math.round(eased * 100));
        percent.textContent = value + "%";
        ring.style.strokeDashoffset = String(263.9 * (1 - value / 100));
        if (raw < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });

    overlay.classList.add("klm-done");
    title.textContent = "Sẵn sàng!";
    subtitle.textContent = "Đang đưa bạn đến trang tiếp theo.";
    await wait(370);
    window.location.assign(destination);
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor || anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self" || anchor.relList?.contains("external") || anchor.hasAttribute("data-no-transition")) return;

    let destination;
    try { destination = new URL(anchor.href, window.location.href); } catch { return; }
    if (!["http:", "https:"].includes(destination.protocol) || destination.origin !== window.location.origin) return;
    if (destination.pathname.startsWith("/api/")) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (anchor.getAttribute("href")?.trim().startsWith("#")) return;
    if (destination.href === window.location.href) return;

    event.preventDefault();
    void playTransition(destination.href);
  });
})();
