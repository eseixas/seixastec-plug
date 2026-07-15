// Código de barras numérico de 13 dígitos, único e nunca reaproveitado.
export async function gerarCodigoBarras(tx) {
  for (let i = 0; i < 12; i++) {
    let cb = '2';
    for (let j = 0; j < 12; j++) cb += Math.floor(Math.random() * 10);
    const existe = await tx.variacao.findUnique({ where: { codigoBarras: cb } });
    if (!existe) return cb;
  }
  return '2' + String(Date.now()).slice(-12);
}
