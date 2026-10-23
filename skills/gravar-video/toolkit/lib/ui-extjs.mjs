// Ajudantes para a interface ExtJS do Proxmox.
export const janela = p => p.locator('.x-window:visible').last();
export const campo = (p, rotulo) => janela(p).locator(`xpath=.//label[normalize-space(.)="${rotulo}"]/following::input[not(@disabled)]`).filter({ visible: true }).first();
export async function digitar(p, loc, texto, delay = 110) {
  await loc.click(); await loc.press('Control+A'); await loc.press('Delete');
  await loc.pressSequentially(texto, { delay }); await loc.press('Tab');
}
export async function escolher(p, loc, opcao) {   // combo ExtJS: abre a lista e clica na opção pelo texto
  await loc.click(); await p.waitForTimeout(600);
  await p.locator('.x-boundlist-item:visible, .x-grid-item:visible', { hasText: opcao }).first().click();
}
export const botao = (p, nome) => janela(p).locator('.x-btn:visible', { hasText: nome }).first();
// Seletor em grade (ComboGrid, ex.: Pool): abre, espera a linha aparecer e clica pelas coordenadas (a máscara de
// carregamento bloqueia o clique do Playwright), depois confere que o campo ficou preenchido.
export async function escolherGrade(p, loc, texto = '') {
  await loc.click(); await p.waitForTimeout(1500);
  const linha = p.locator('.x-grid-item:visible', texto ? { hasText: texto } : {}).last(); // a lista flutuante é a última no DOM
  await linha.waitFor({ timeout: 10000 });
  const b = await linha.boundingBox();
  await p.mouse.click(b.x + 40, b.y + b.height / 2); await p.waitForTimeout(700);
  if (!(await loc.inputValue())) throw new Error('seletor em grade não ficou preenchido');
}
// Campo por nome interno (name=...), quando o rótulo é ambíguo ou há campos ocultos duplicados.
export const porNome = (p, nome) => janela(p).locator(`input[name="${nome}"]:not([disabled])`).filter({ visible: true }).first();
