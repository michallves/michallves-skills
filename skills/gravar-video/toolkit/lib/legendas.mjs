// Gera legendas .srt a partir das falas e dos instantes em que cada uma foi dita.
const t = s => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

// itens: [{ ini, d, texto }] em segundos, já relativos ao início do vídeo final.
export function srt(itens) {
  return itens.filter(i => i.texto).map((i, n) => `${n + 1}\n${t(i.ini)} --> ${t(i.ini + i.d)}\n${i.texto.replace(/`/g, '')}\n`).join('\n');
}
