#!/usr/bin/env node
// Gravador de vídeo de tela para qualquer sistema web (Playwright + overlay + narração opcional).
// Uso (na pasta do projeto): node <kit>/bin/gravar.mjs <roteiro.yaml|.mjs> <saida.mp4>
// Env: MODO=narrado|silencioso (sobrepõe o roteiro), CAPS=2,3 (só esses capítulos), TTS_VOZ, TTS_RATE,
//      RASCUNHO=1 (720p, rápido, só para validar roteiro e seletores; grava out/<saida>-rascunho.mp4).
// Roteiro com `cache: capitulos`: cada capítulo vira um segmento independente (começa em `base`), é guardado em cache
// e só é regravado se mudar; o vídeo final é a junção dos segmentos. Sem isso, a gravação é contínua (um capítulo
// herda o estado do anterior).
// Saídas: out/<saida>.mp4 e out/<saida>.srt; intermediários e caches em work/.
import { chromium } from 'playwright';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { falarVarios, VOZ, RATE } from '../lib/fala.mjs';
import { srt } from '../lib/legendas.mjs';

const KIT = new URL('..', import.meta.url).pathname;
const [, , roteiroArq, saidaArg] = process.argv;
if (!roteiroArq || !saidaArg) { console.error('Uso: gravar.mjs <roteiro.yaml|.mjs> <saida.mp4>'); process.exit(2); }

async function carregar(arq) {
  if (/\.ya?ml$/i.test(arq)) return YAML.parse(fs.readFileSync(arq, 'utf8'));
  const m = await import(path.resolve(arq));   // .mjs: export const roteiro / default / ou { capitulos, ... }
  return m.roteiro || m.default || m;
}
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 20);
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });
const dur = f => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

const R = await carregar(roteiroArq);
const modo = process.env.MODO || R.modo || 'narrado';
const narrado = modo === 'narrado';
const rascunho = process.env.RASCUNHO === '1';
const [VW, VH] = rascunho ? [1280, 720] : String(R.viewport || '1920x1080').split('x').map(Number);
const SLOWMO = rascunho ? 100 : (R.slowmo ?? 400), FOLGA = rascunho ? 0.3 : (R.folga ?? 0.7);
const ATRASO = rascunho ? 30 : null;   // ms por caractere digitado
const CODEC = rascunho ? ['-preset', 'veryfast', '-crf', '28'] : ['-preset', 'medium', '-crf', '20'];
const base = R.base;
const so = process.env.CAPS ? process.env.CAPS.split(',').map(Number) : null;
const capitulos = (R.capitulos || []).filter(c => !so || so.includes(c.num));
if (!capitulos.length) { console.error('roteiro sem capítulos'); process.exit(2); }

const PROJ = process.cwd();
const nome = path.basename(saidaArg, '.mp4') + (rascunho ? '-rascunho' : '');
const W = path.join(PROJ, 'work', nome);
const CACHE_FALAS = path.join(PROJ, 'work', 'cache-falas');
const CACHE_CAPS = path.join(PROJ, 'work', 'cache-capitulos');
fs.rmSync(W, { recursive: true, force: true });
fs.mkdirSync(W, { recursive: true }); fs.mkdirSync(CACHE_CAPS, { recursive: true });
fs.mkdirSync(path.join(PROJ, 'out'), { recursive: true });
const saidaArq = path.isAbsolute(saidaArg) ? saidaArg.replace(/\.mp4$/, '') + (rascunho ? '-rascunho' : '') + '.mp4'
  : path.join(PROJ, 'out', nome + '.mp4');
const srtArq = saidaArq.replace(/\.mp4$/, '.srt');

// Segmentos: um só (gravação contínua) ou um por capítulo (cache). A chave do cache não depende das falas já geradas.
const repl = (k, v) => (typeof v === 'function' ? v.toString() : v);
const chaveBase = JSON.stringify({
  v: 1,   // some 1 ao mudar a lógica de gravação/mixagem, para invalidar caches antigos
  base, modo, VW, VH, SLOWMO, FOLGA, ATRASO, VOZ, RATE, pron: R.pronuncia || {}, pronto: R.prontoQuando,
  overlay: sha(fs.readFileSync(path.join(KIT, 'lib/overlay.js'))), dic: sha(fs.readFileSync(path.join(KIT, 'pronuncia.json'))),
});
const porCapitulo = R.cache === 'capitulos';
const segmentos = (porCapitulo ? capitulos.map(c => [c]) : [capitulos]).map((caps, n) => {
  const chave = sha(chaveBase + JSON.stringify(caps, repl));
  return { caps, n, chave, mp4: path.join(CACHE_CAPS, `${chave}.mp4`), meta: path.join(CACHE_CAPS, `${chave}.json`), cacheado: false };
});
for (const s of segmentos) s.cacheado = porCapitulo && !process.env.SEM_CACHE && fs.existsSync(s.mp4) && fs.existsSync(s.meta);
if (porCapitulo) console.log(`capítulos em cache: ${segmentos.filter(s => s.cacheado).length}/${segmentos.length}`);

// 1) Narração dos segmentos que vão ser gravados, gerada antes (em paralelo) para saber a duração de cada fala.
if (narrado) {
  const jobs = [];
  for (const s of segmentos.filter(x => !x.cacheado)) for (const c of s.caps) {
    if (!c.semCartao) jobs.push([c, `Capítulo ${c.num}. ${c.titulo}.`]);
    for (const p of c.passos) if (p.say) jobs.push([p, p.say]);
  }
  const falas = await falarVarios(jobs.map(j => j[1]), { cacheDir: CACHE_FALAS, dicionario: R.pronuncia || {} });
  jobs.forEach(([obj], i) => { obj.audio = falas[i]; });
  console.log(`narração pronta: ${jobs.length} trechos (${falas.filter(f => f.cache).length} do cache)`);
}

// 2) Ações declarativas (YAML) ou funções (.mjs)
const retangulo = async (page, alvo) => {
  if (!alvo) return null;
  if (typeof alvo === 'function') alvo = await alvo(page);
  if (alvo && typeof alvo === 'object' && 'x' in alvo) return alvo;
  const loc = typeof alvo === 'string' ? page.locator(alvo) : alvo;
  await loc.first().scrollIntoViewIfNeeded();
  const b = await loc.first().boundingBox();
  if (!b) throw new Error('alvo sem caixa na tela');
  return { x: b.x, y: b.y, w: b.width, h: b.height };
};
const mover = async (page, alvo) => {
  const r = await retangulo(page, alvo);
  if (r) await page.mouse.move(r.x + Math.min(r.w / 2, 120), r.y + r.h / 2, { steps: 20 });
};
async function executar(page, acoes) {
  for (const a of [].concat(acoes || [])) {
    if (typeof a === 'function') { await a(page); continue; }
    const [k] = Object.keys(a); const v = a[k];
    if (k === 'goto') await page.goto(base ? new URL(v, base).href : v, { waitUntil: 'load' });
    else if (k === 'click') { await mover(page, v); await page.locator(v).first().click(); }
    else if (k === 'type') {
      const [sel, texto, atraso] = Array.isArray(v) ? v : [v.sel, v.texto, v.atraso];
      await mover(page, sel); const l = page.locator(sel).first(); await l.click();
      await l.pressSequentially(String(texto), { delay: ATRASO ?? atraso ?? 110 });
    }
    else if (k === 'press') await page.keyboard.press(v);
    else if (k === 'scroll') await page.mouse.wheel(0, Number(v));
    else if (k === 'espera') await page.waitForTimeout(rascunho ? Math.min(Number(v), 300) : Number(v));
    else if (k === 'aguardar') await page.locator(v).first().waitFor();
    else if (k === 'mover' || k === 'hover') await mover(page, v);
    else throw new Error(`ação desconhecida: ${k}`);
  }
}

// 3) Gravação
let state = R.sessao && fs.existsSync(R.sessao) ? path.resolve(R.sessao) : undefined;   // storageState salvo pelo login do usuário
const aGravar = segmentos.filter(s => !s.cacheado);
const browser = aGravar.length ? await chromium.launch({ slowMo: SLOWMO }) : null;
if (R.aquecer && aGravar.length) {   // a 1ª carga de SPAs com permissão limitada costuma falhar: aquece sem gravar e reaproveita o estado
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: VW, height: VH }, ignoreHTTPSErrors: true, ...(state ? { storageState: state } : {}) });
  const p = await c.newPage(); await p.goto(base, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  state = await c.storageState(); await b.close();
}
const erros = [];

async function gravarSegmento(seg) {
  const dirVideo = path.join(W, `seg${seg.n}`, 'video');
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH }, ignoreHTTPSErrors: true, ...(state ? { storageState: state } : {}),
    recordVideo: { dir: dirVideo, size: { width: VW, height: VH } },
  });
  await ctx.addInitScript({ path: path.join(KIT, 'lib/overlay.js') });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);   // falha rápido: o passo é registrado e a gravação continua
  const t0 = Date.now(); const agora = () => (Date.now() - t0) / 1000;
  if (base) await page.goto(base, { waitUntil: 'load' });
  if (R.prontoQuando) await page.locator(R.prontoQuando).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(rascunho ? 800 : 2500);
  const corte = agora() - 0.2;   // tudo antes disso é tela carregando

  const faixas = [], legendas = [], errosSeg = [];
  const dizer = async (p, texto) => {
    const ini = agora();
    if (p.audio) { faixas.push({ f: p.audio.f, ini }); await page.waitForTimeout(p.audio.d * 1000 + FOLGA * 1000); legendas.push({ ini: ini - corte, d: p.audio.d, texto }); return; }
    const pausa = (p.pausa ?? Math.min(7, Math.max(2.5, 2 + (p.balao || '').length / 18))) * (rascunho ? 0.4 : 1);
    await page.waitForTimeout(pausa * 1000);
    if (texto) legendas.push({ ini: ini - corte, d: pausa, texto });
  };
  const tente = async (rotulo, fn) => {
    try { await fn(); } catch (e) {
      errosSeg.push(`${rotulo}: ${String(e.message).split('\n')[0]}`); console.log('FALHA', errosSeg.at(-1));
      await page.screenshot({ path: path.join(W, `erro-${seg.n}-${errosSeg.length}.png`) }).catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
    }
  };

  for (const c of seg.caps) {
    if (!c.semCartao) {
      await page.evaluate(([n, t, s]) => window.__tut.card('Capítulo ' + n, t, s), [c.num, c.titulo, c.sub || '']);
      await page.waitForTimeout(600);
      if (c.audio) { faixas.push({ f: c.audio.f, ini: agora() }); await page.waitForTimeout(c.audio.d * 1000 + FOLGA * 1000); } else await page.waitForTimeout(rascunho ? 800 : 2500);
      await page.waitForTimeout(500);
    }
    if (c.antesCap) await tente(`cap${c.num} antesCap`, () => executar(page, c.antesCap));
    if (!c.semCartao) { await page.evaluate(() => window.__tut.cardOff()); await page.waitForTimeout(700); }
    let i = 0;
    for (const p of c.passos) {
      i++;
      await page.evaluate(() => window.__tut.clear());
      if (p.antes) await tente(`cap${c.num} passo ${i} antes`, () => executar(page, p.antes));
      let r = null;
      try { r = await retangulo(page, p.alvo); } catch (e) { errosSeg.push(`cap${c.num} passo ${i} alvo: ${String(e.message).split('\n')[0]}`); }
      if (p.mover) await mover(page, p.mover).catch(() => {});
      if (r) await page.evaluate(([r, t, n, pos]) => window.__tut.spot(r, t, n, pos), [r, p.balao || '', `${i}/${c.passos.length}`, p.pos]);
      else if (p.balao) await page.evaluate(([t]) => window.__tut.spot({ x: -200, y: -200, w: 0, h: 0 }, t, '', 'topo'), [p.balao]);
      await dizer(p, narrado ? p.say : p.balao);
      if (p.depois) await tente(`cap${c.num} passo ${i} depois`, () => executar(page, p.depois));
    }
    await page.evaluate(() => window.__tut.clear());
  }
  const fim = agora();
  await ctx.close();
  erros.push(...errosSeg);

  // Mixagem: falas alinhadas ao instante do balão e volume normalizado (loudnorm)
  const webm = fs.readdirSync(dirVideo).map(f => path.join(dirVideo, f))[0];
  const comum = ['-y', '-v', 'error', '-ss', corte.toFixed(2), '-i', webm];
  const video = ['-t', (fim - corte).toFixed(2), '-r', '30', '-c:v', 'libx264', ...CODEC, '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  const destino = porCapitulo ? seg.mp4 : path.join(W, `seg${seg.n}.mp4`);
  if (faixas.length) {
    const ins = faixas.flatMap(x => ['-i', x.f]);
    const filtros = faixas.map((x, i) => { const ms = Math.max(0, Math.round((x.ini - corte) * 1000)); return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`; });
    const mix = `${filtros.join(';')};${faixas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${faixas.length}:normalize=0:dropout_transition=0[mix];[mix]loudnorm=I=-16:TP=-1.5:LRA=11[aout]`;
    sh('ffmpeg', [...comum, ...ins, '-filter_complex', mix, '-map', '0:v', '-map', '[aout]', ...video, '-c:a', 'aac', '-b:a', '192k', destino]);
  } else {
    sh('ffmpeg', [...comum, ...video, '-an', destino]);
  }
  const meta = { legendas, dur: dur(destino), erros: errosSeg.length };
  // segmento com falha de passo não entra no cache: da próxima vez é regravado
  if (porCapitulo) { if (errosSeg.length) fs.rmSync(seg.meta, { force: true }); else fs.writeFileSync(seg.meta, JSON.stringify(meta)); }
  return { ...meta, mp4: destino };
}

const prontos = [];
for (const seg of segmentos) {
  if (seg.cacheado) { prontos.push({ ...JSON.parse(fs.readFileSync(seg.meta, 'utf8')), mp4: seg.mp4, doCache: true }); continue; }
  prontos.push(await gravarSegmento(seg));
}
if (browser) await browser.close();
fs.writeFileSync(path.join(W, 'erros.txt'), erros.join('\n'));

// 4) Junção (quando há mais de um segmento) e legendas .srt com os instantes deslocados
if (prontos.length === 1) fs.copyFileSync(prontos[0].mp4, saidaArq);
else {
  const lista = path.join(W, 'lista.txt');
  fs.writeFileSync(lista, prontos.map(p => `file '${p.mp4.replace(/'/g, "'\\''")}'`).join('\n'));
  sh('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', saidaArq]);
}
let deslocamento = 0; const todas = [];
for (const p of prontos) { todas.push(...p.legendas.map(l => ({ ...l, ini: l.ini + deslocamento }))); deslocamento += p.dur; }
fs.writeFileSync(srtArq, srt(todas));
console.log(`vídeo: ${saidaArq} (${dur(saidaArq).toFixed(1)} s, modo ${modo}${rascunho ? ', RASCUNHO' : ''}${porCapitulo ? `, ${prontos.filter(p => p.doCache).length}/${prontos.length} capítulos do cache` : ''})`);
console.log(`legendas: ${srtArq}`);
if (erros.length) console.log(`ATENÇÃO: ${erros.length} falha(s) em passos; veja ${path.join(W, 'erros.txt')} e os erro-*.png`);
