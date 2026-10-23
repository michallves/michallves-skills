// Narração: ajusta o texto para o TTS ler direito e gera o mp3 com cache por hash (voz + velocidade + texto final).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
const execFileP = promisify(execFile);

const KIT = new URL('..', import.meta.url).pathname;
const base = JSON.parse(fs.readFileSync(path.join(KIT, 'pronuncia.json'), 'utf8'));
const esc = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

export const VOZ = process.env.TTS_VOZ || 'pt-BR-ThalitaMultilingualNeural';
export const RATE = process.env.TTS_RATE || '+0%';

// Reescreve o texto para fala: tira crases, lê IPs e versões ("192.0.2.10" -> "192 ponto 0 ponto 2 ponto 10")
// e aplica o dicionário (base + o do roteiro; o do roteiro vence).
export function pronunciar(texto, extra = {}) {
  let t = String(texto).replace(/`([^`]*)`/g, '$1');
  t = t.replace(/\b\d+(?:\.\d+){2,}\b/g, m => m.replace(/\./g, ' ponto '));
  const dic = { ...base, ...extra };
  for (const k of Object.keys(dic).sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc(k)}(?![\\p{L}\\p{N}])`, 'gu'), dic[k]);
  }
  return t.replace(/\s+/g, ' ').trim();
}

const duracao = f => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));

const preparar = (texto, { cacheDir, dicionario = {}, voz = VOZ, rate = RATE }) => {
  const falado = pronunciar(texto, dicionario);
  const chave = crypto.createHash('sha1').update(`${voz}|${rate}|${falado}`).digest('hex').slice(0, 20);
  fs.mkdirSync(cacheDir, { recursive: true });
  return { falado, voz, rate, f: path.join(cacheDir, `${chave}.mp3`) };
};
const emCache = f => fs.existsSync(f) && fs.statSync(f).size > 0;
const argsTts = (x, tmp) => ['--voice', x.voz, `--rate=${x.rate}`, '--text', x.falado, '--write-media', tmp];

// Gera (ou reaproveita do cache) o áudio de um texto. Devolve { f, d, falado, cache }.
export function falar(texto, opts) {
  const x = preparar(texto, opts); const cache = emCache(x.f);
  if (!cache) {
    const tmp = `${x.f}.tmp.mp3`;
    execFileSync(path.join(KIT, '.venv/bin/edge-tts'), argsTts(x, tmp), { stdio: ['ignore', 'ignore', 'inherit'] });
    fs.renameSync(tmp, x.f);
  }
  return { f: x.f, d: duracao(x.f), falado: x.falado, cache };
}

// Gera vários textos ao mesmo tempo (n por vez). Textos iguais compartilham uma única geração. Devolve a lista na mesma ordem.
export async function falarVarios(textos, opts, n = 5) {
  const itens = textos.map(t => preparar(t, opts));
  const emVoo = new Map();
  const gerar = x => {
    if (emCache(x.f)) return Promise.resolve(true);
    if (!emVoo.has(x.f)) emVoo.set(x.f, (async () => {
      const tmp = `${x.f}.tmp.mp3`;
      await execFileP(path.join(KIT, '.venv/bin/edge-tts'), argsTts(x, tmp));
      fs.renameSync(tmp, x.f); return false;
    })());
    return emVoo.get(x.f);
  };
  const res = new Array(itens.length); let i = 0;
  const trabalhador = async () => {
    while (i < itens.length) {
      const k = i++; const x = itens[k]; const jaTinha = emCache(x.f);
      await gerar(x);
      res[k] = { f: x.f, d: duracao(x.f), falado: x.falado, cache: jaTinha };
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
  return res;
}
