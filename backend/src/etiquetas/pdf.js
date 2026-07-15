import PDFDocument from 'pdfkit';

// Formatação local de moeda em Real (não dá pra importar o helper do frontend).
// Equivale a `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
function formatBRL(value) {
  const n = Number(value) || 0;
  return `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const MM = 2.83465; // 1mm em pontos

// Desenha o conteúdo de UMA etiqueta dentro de uma caixa (x, y, w, h).
// Reutilizado tanto pela versão térmica (1 caixa = página inteira) quanto pela
// A4 (grade de caixas). Layout vertical centralizado.
function desenharEtiqueta(doc, item, x, y, w, h) {
  const pad = 4;
  const innerX = x + pad;
  const innerW = w - pad * 2;
  let cursorY = y + pad;

  // Nome do produto (até 2 linhas, fonte pequena).
  doc.font('Helvetica-Bold').fontSize(7);
  const nome = item.produtoNome || '';
  doc.text(nome, innerX, cursorY, {
    width: innerW,
    align: 'center',
    lineBreak: true,
    height: 18,
    ellipsis: true,
  });
  cursorY += 18;

  // Cor · Tamanho
  const detalhe = [item.cor, item.tamanho].filter(Boolean).join(' · ');
  doc.font('Helvetica').fontSize(6);
  doc.text(detalhe, innerX, cursorY, { width: innerW, align: 'center' });
  cursorY += 9;

  // Preço (fonte maior/negrito).
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(formatBRL(item.precoVenda), innerX, cursorY, { width: innerW, align: 'center' });
  cursorY += 13;

  // Imagem do código de barras. Altura restante reservando espaço para o número.
  const numeroH = 8;
  const barcodeMaxH = y + h - pad - numeroH - cursorY;
  if (item.barcodeImageBuffer && barcodeMaxH > 6) {
    const bcH = Math.min(barcodeMaxH, 22);
    const bcW = Math.min(innerW, innerW);
    try {
      doc.image(item.barcodeImageBuffer, innerX, cursorY, {
        fit: [bcW, bcH],
        align: 'center',
        valign: 'top',
      });
    } catch {
      /* imagem inválida: ignora, ainda mostra o número abaixo */
    }
    cursorY += bcH + 1;
  }

  // Número do código em fonte monoespaçada pequena.
  doc.font('Courier').fontSize(6);
  doc.text(item.codigoBarras || '', innerX, cursorY, { width: innerW, align: 'center' });
}

// Etiqueta térmica (rolo): uma página por etiqueta, ~50x30mm.
export async function gerarPdfTermica(itens) {
  const largura = 50 * MM; // ~141.7pt
  const altura = 30 * MM; // ~85pt
  const doc = new PDFDocument({ size: [largura, altura], margin: 0 });

  itens.forEach((item, idx) => {
    if (idx > 0) doc.addPage({ size: [largura, altura], margin: 0 });
    desenharEtiqueta(doc, item, 0, 0, largura, altura);
  });

  return doc;
}

// Folha A4 com grade de etiquetas: 3 colunas x 8 linhas = 24 por página.
export async function gerarPdfA4(itens) {
  const margem = 10 * MM;
  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  const pageW = doc.page.width; // 595.28pt
  const pageH = doc.page.height; // 841.89pt
  const cols = 3;
  const rows = 8;
  const gap = 3 * MM;

  const usableW = pageW - margem * 2;
  const usableH = pageH - margem * 2;
  const cellW = (usableW - gap * (cols - 1)) / cols;
  const cellH = (usableH - gap * (rows - 1)) / rows;
  const perPage = cols * rows;

  itens.forEach((item, idx) => {
    const posInPage = idx % perPage;
    if (idx > 0 && posInPage === 0) doc.addPage({ size: 'A4', margin: 0 });

    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = margem + col * (cellW + gap);
    const y = margem + row * (cellH + gap);

    // Moldura leve pra facilitar o recorte.
    doc.save();
    doc.lineWidth(0.3).strokeColor('#cccccc').rect(x, y, cellW, cellH).stroke();
    doc.restore();

    desenharEtiqueta(doc, item, x, y, cellW, cellH);
  });

  return doc;
}
