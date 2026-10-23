// Injetado em toda página pelo Playwright (addInitScript). Cria: cursor visível, cartão de capítulo e balão "Passo guiado".
(() => {
  if (window.__tut) return;
  const LARANJA = '#e57000', AZUL = '#0f172a';
  const css = `
  #__tut-cursor{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
    background:rgba(229,112,0,.55);border:3px solid #fff;box-shadow:0 0 0 2px rgba(15,23,42,.6);z-index:2147483500;
    pointer-events:none;transition:transform .55s cubic-bezier(.22,.8,.3,1)}
  #__tut-cursor.click{animation:__tutclick .5s ease-out}
  @keyframes __tutclick{0%{box-shadow:0 0 0 0 rgba(229,112,0,.8)}100%{box-shadow:0 0 0 34px rgba(229,112,0,0)}}
  #__tut-hole{position:fixed;z-index:2147483000;border-radius:10px;pointer-events:none;border:3px solid ${LARANJA};
    box-shadow:0 0 0 9999px rgba(15,23,42,.58);transition:all .45s ease;opacity:0}
  #__tut-hole.full{box-shadow:none;border-color:transparent}
  #__tut-tip{position:fixed;z-index:2147483100;width:460px;padding:16px 20px 18px;border-radius:14px;background:${AZUL};color:#fff;
    font:500 21px/1.38 system-ui,Segoe UI,Roboto,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.45);pointer-events:none;
    transition:left .45s ease,top .45s ease,opacity .3s;opacity:0}
  #__tut-tip b{display:inline-block;font:700 14px system-ui;letter-spacing:.08em;text-transform:uppercase;background:${LARANJA};
    color:#fff;padding:4px 10px;border-radius:999px;margin-bottom:10px}
  #__tut-card{position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;font-family:system-ui,Segoe UI,Roboto,sans-serif;
    opacity:0;pointer-events:none;transition:opacity .5s}
  #__tut-card .n{font:700 26px system-ui;letter-spacing:.14em;color:${LARANJA};text-transform:uppercase;margin-bottom:18px}
  #__tut-card .t{font:800 76px/1.1 system-ui;text-align:center;max-width:1500px}
  #__tut-card .s{font:400 32px system-ui;color:#cbd5e1;margin-top:22px;text-align:center;max-width:1300px}
  #__tut-card .l{width:140px;height:6px;background:${LARANJA};border-radius:3px;margin-top:34px}`;
  const montar = () => {
    const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st);
    const mk = (id, cls) => { const d = document.createElement('div'); d.id = id; if (cls) d.className = cls; document.documentElement.appendChild(d); return d; };
    const cur = mk('__tut-cursor'), hole = mk('__tut-hole'), tip = mk('__tut-tip'), card = mk('__tut-card');
    cur.style.transform = 'translate(960px,540px)';
    document.addEventListener('mousemove', e => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    document.addEventListener('mousedown', () => { cur.classList.remove('click'); void cur.offsetWidth; cur.classList.add('click'); }, true);

    window.__tut = {
      card(num, titulo, sub) {
        card.innerHTML = `<div class="n">${num}</div><div class="t">${titulo}</div>${sub ? `<div class="s">${sub}</div>` : ''}<div class="l"></div>`;
        card.style.opacity = 1;
      },
      cardOff() { card.style.opacity = 0; },
      // r = {x,y,w,h}; pos: 'abaixo'|'acima'|'direita'|'esquerda'|'topo' (topo = dentro da área, canto superior direito)
      spot(r, texto, passo, pos) {
        const p = 6, W = innerWidth, H = innerHeight;
        hole.classList.remove('full');
        hole.style.cssText += `;left:${r.x - p}px;top:${r.y - p}px;width:${r.w + 2 * p}px;height:${r.h + 2 * p}px;opacity:1`;
        tip.innerHTML = `<b>Passo guiado${passo ? ' · ' + passo : ''}</b><div>${texto}</div>`;
        tip.style.opacity = 1;
        const tw = 460, th = tip.offsetHeight, g = 18;
        let x, y;
        const opts = {
          abaixo: [r.x, r.y + r.h + p + g], acima: [r.x, r.y - th - p - g],
          direita: [r.x + r.w + p + g, r.y], esquerda: [r.x - tw - p - g, r.y],
          topo: [W - tw - 40, 90]
        };
        [x, y] = opts[pos || 'abaixo'];
        x = Math.max(20, Math.min(W - tw - 20, x)); y = Math.max(20, Math.min(H - th - 20, y));
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      },
      clear() { hole.style.opacity = 0; tip.style.opacity = 0; },
      // Terminal simulado: digita cada comando (110 ms/char) e mostra a saída REAL já capturada. itens: [{cmd, out}]
      async term(titulo, itens, prompt, manter) {
        prompt = prompt || ['usuario@servidor', '~'];
        let t = document.getElementById('__tut-term');
        if (!t) { t = document.createElement('div'); t.id = '__tut-term';
          t.style.cssText = 'position:fixed;inset:70px 120px;z-index:2147483300;background:#0b1220;color:#d1fae5;border-radius:14px;padding:0;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);font:22px/1.5 ui-monospace,Menlo,Consolas,monospace;display:flex;flex-direction:column';
          document.documentElement.appendChild(t); }
        if (manter && t.querySelector('pre')) t.firstChild.textContent = titulo;
        else t.innerHTML = '<div style="background:#1e293b;color:#cbd5e1;padding:10px 18px;font:600 18px system-ui">' + titulo + '</div><pre id="__tut-pre" style="margin:0;padding:18px 24px;white-space:pre-wrap;flex:1;overflow:hidden"></pre>';
        const pre = t.querySelector('pre'); const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
        for (const it of itens) {
          pre.innerHTML += '<span style="color:#38bdf8">' + prompt[0] + '</span>:<span style="color:#a78bfa">' + prompt[1] + '</span>$ ';
          for (const ch of it.cmd) { pre.innerHTML += esc(ch); await new Promise(r => setTimeout(r, 110)); }
          await new Promise(r => setTimeout(r, 500)); pre.innerHTML += '\n' + esc(it.out) + '\n';
          await new Promise(r => setTimeout(r, 900));
        }
      },
      termOff() { const t = document.getElementById('__tut-term'); if (t) t.remove(); }
    };
  };
  if (document.documentElement) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
