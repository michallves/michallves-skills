#!/usr/bin/env node
// Verifica um vídeo gravado: codec, resolução, duração, áudio, volume (LUFS), quadros pretos, imagem congelada e falhas de passo.
// Uso: verificar.mjs <video.mp4> [--silencioso] [--res 1920x1080] [--erros work/<nome>/erros.txt]
// Sai com código 1 se algum item reprovar (AVISO não reprova).
import fs from 'fs';
import { spawnSync, execFileSync } from 'child_process';

const args = process.argv.slice(2);
const arq = args.find(a => !a.startsWith('--') && !/^\d+x\d+$/.test(a) && !a.endsWith('erros.txt'));
const opt = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
if (!arq || !fs.existsSync(arq)) { console.error('Uso: verificar.mjs <video.mp4> [--silencioso] [--res WxH] [--erros arquivo]'); process.exit(2); }
const silencioso = args.includes('--silencioso');
const [W, H] = (opt('res') || '1920x1080').split('x').map(Number);

const res = [];
const ok = (nome, passou, detalhe, aviso = false) => res.push({ nome, estado: passou ? 'OK' : (aviso ? 'AVISO' : 'FALHA'), detalhe });

const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', arq], { encoding: 'utf8' }));
const v = probe.streams.find(s => s.codec_type === 'video'), a = probe.streams.find(s => s.codec_type === 'audio');
const dur = parseFloat(probe.format.duration);
ok('vídeo H.264 yuv420p', v?.codec_name === 'h264' && v?.pix_fmt === 'yuv420p', `${v?.codec_name}/${v?.pix_fmt}`);
ok(`resolução ${W}x${H}`, v?.width === W && v?.height === H, `${v?.width}x${v?.height}`);
ok('duração > 5 s', dur > 5, `${dur.toFixed(1)} s`);
if (silencioso) ok('sem áudio (modo silencioso)', !a, a ? 'tem faixa de áudio' : 'sem áudio');
else ok('áudio AAC presente', a?.codec_name === 'aac', a?.codec_name || 'sem áudio');

// Uma única leitura do arquivo: volume (ebur128) no áudio e tela preta + imagem parada no vídeo.
const filtros = ['-nostats', '-hide_banner', '-i', arq, '-vf', 'blackdetect=d=1.5:pix_th=0.08,freezedetect=n=-60dB:d=12'];
if (a) filtros.push('-af', 'ebur128=peak=true');
const log = spawnSync('ffmpeg', [...filtros, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).stderr;

if (a) {
  const resumo = log.slice(log.lastIndexOf('Summary:'));
  const lufs = parseFloat((resumo.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]);
  const pico = parseFloat((resumo.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1]);
  ok('volume entre -19 e -13 LUFS', lufs >= -19 && lufs <= -13, `${lufs} LUFS`);
  ok('pico abaixo de 0 dBFS', pico < 0, `${pico} dBFS`);
}
const pretos = [...log.matchAll(/black_start:([\d.]+).*black_duration:([\d.]+)/g)].map(m => `${(+m[1]).toFixed(1)}s (${(+m[2]).toFixed(1)}s)`);
ok('sem tela preta > 1,5 s', pretos.length === 0, pretos.join(', ') || 'nenhuma');
const congel = [...log.matchAll(/freeze_start: ([\d.]+)/g)].map(m => `${(+m[1]).toFixed(1)}s`);
ok('sem imagem parada > 12 s', congel.length === 0, congel.join(', ') || 'nenhuma', true);

const errArq = opt('erros');
if (errArq && fs.existsSync(errArq)) {
  const linhas = fs.readFileSync(errArq, 'utf8').split('\n').filter(Boolean);
  ok('nenhum passo falhou na gravação', linhas.length === 0, linhas.length ? linhas.slice(0, 3).join(' | ') : 'nenhuma');
}

for (const r of res) console.log(`${r.estado.padEnd(5)} ${r.nome}  [${r.detalhe}]`);
const falhas = res.filter(r => r.estado === 'FALHA').length;
console.log(falhas ? `\n${falhas} item(ns) reprovado(s)` : '\nverificação aprovada');
process.exit(falhas ? 1 : 0);
