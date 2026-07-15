import bwipjs from 'bwip-js';

// Renderiza o código de barras como imagem PNG (Buffer) usando symbology Code128.
// Usamos Code128 (não EAN-13) porque os códigos gerados internamente são 13
// dígitos SEM dígito verificador EAN válido — um leitor rejeitaria por checksum.
// `includetext: false` porque o PDF desenha o número embaixo do barcode com
// controle próprio de fonte/tamanho.
export async function gerarImagemBarcode(codigo) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: String(codigo),
    scale: 3,
    height: 10,
    includetext: false,
  });
}
