import PDFDocument from 'pdfkit';

// Formatação local de moeda em Real (não dá pra importar o helper do frontend).
// Equivale a `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
export function formatBRL(value) {
  const n = Number(value) || 0;
  return `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const MM = 2.83465; // 1mm em pontos

const ALINHAMENTO = { L: 'left', C: 'center', R: 'right' };

// Fonte base -> [regular, negrito] embutidas no pdfkit.
const FONTES = {
  Helvetica: ['Helvetica', 'Helvetica-Bold'],
  Times: ['Times-Roman', 'Times-Bold'],
  Courier: ['Courier', 'Courier-Bold'],
};

// Resolve o texto de uma linha de conteúdo a partir do item da etiqueta.
function resolverCampo(item, linha) {
  switch (linha.campo) {
    case 'COMPANY_NAME':
      return item.companyName || '';
    case 'PRODUCT_CODE':
      return item.codigo || '';
    case 'PRODUCT_NAME':
      return item.produtoNome || '';
    case 'PRODUCT_CODE_NAME':
      return [item.codigo, item.produtoNome].filter(Boolean).join(' - ');
    case 'PRODUCT_CATEGORY':
      return item.categoria || '';
    case 'PRODUCT_VALUE':
      return formatBRL(item.precoVenda);
    case 'TEXT':
      return linha.texto || '';
    default:
      return '';
  }
}

// Desenha uma etiqueta dentro da célula (x, y, w, h) conforme o modelo.
function desenharEtiqueta(doc, modelo, item, x, y, w, h) {
  const [fonteRegular, fonteNegrito] = FONTES[modelo.fonteTipo] || FONTES.Helvetica;
  const align = ALINHAMENTO[modelo.alinhamento] || 'center';

  const innerX = x + modelo.espacoEsquerda * MM;
  const innerY = y + modelo.espacoSuperior * MM;
  const innerW = w - (modelo.espacoEsquerda + modelo.espacoDireita) * MM;
  const innerH = h - (modelo.espacoSuperior + modelo.espacoInferior) * MM;

  let cursorY = innerY;
  const limiteY = innerY + innerH;
  const linhas = Array.isArray(modelo.linhasConteudo) ? modelo.linhasConteudo : [];

  linhas.forEach((linha, idx) => {
    const texto = resolverCampo(item, linha);
    if (!texto) return;

    const destaque = idx === 0 || linha.campo === 'PRODUCT_VALUE';
    const tamanho = linha.campo === 'PRODUCT_VALUE' ? modelo.fonteTamanho + 2 : modelo.fonteTamanho;
    doc.font(destaque ? fonteNegrito : fonteRegular).fontSize(tamanho);
    const alturaLinha = doc.currentLineHeight();
    if (cursorY + alturaLinha > limiteY) return;

    doc.text(texto, innerX, cursorY, { width: innerW, align, lineBreak: false, ellipsis: true });
    cursorY += alturaLinha;
  });

  if (modelo.imagemLeituraTipo === 'NENHUMA' || !item.leituraImagemBuffer) return;

  const mostraNumero = modelo.imagemLeituraTipo === 'BARCODE';
  const numeroH = mostraNumero ? 8 : 0;
  const imagemMaxH = limiteY - cursorY - numeroH;
  if (imagemMaxH <= 6) return;

  const imagemH = Math.min(imagemMaxH, modelo.imagemLeituraTipo === 'QRCODE' ? innerW : 22);
  try {
    doc.image(item.leituraImagemBuffer, innerX, cursorY, {
      fit: [innerW, imagemH],
      align,
      valign: 'top',
    });
  } catch {
    /* imagem inválida: ignora */
  }
  cursorY += imagemH + 1;

  if (mostraNumero && cursorY < limiteY) {
    doc.font('Courier').fontSize(6);
    doc.text(item.codigoBarras || '', innerX, cursorY, { width: innerW, align });
  }
}

// Gera o PDF de etiquetas para um modelo. `itens` já vem achatado (uma entrada
// por etiqueta física), com os campos resolvíveis (produtoNome, codigo, categoria,
// precoVenda, companyName, codigoBarras, leituraImagemBuffer).
export async function gerarPdfComModelo(modelo, itens, opcoes = {}) {
  const { posicaoInicial = 1, imprimirBorda = false } = opcoes;

  const folhaW = Number(modelo.folhaLargura) * MM;
  const folhaH = Number(modelo.folhaAltura) * MM;
  const cols = modelo.colunas;
  const rows = modelo.linhasFolha;
  const cellW = Number(modelo.etiquetaLargura) * MM;
  const cellH = Number(modelo.etiquetaAltura) * MM;
  const gapX = Number(modelo.espacamentoColunas) * MM;
  const gapY = Number(modelo.espacamentoLinhas) * MM;
  const margemX = Number(modelo.margemEsquerda) * MM;
  const margemY = Number(modelo.margemTopo) * MM;
  const perPage = cols * rows;

  const doc = new PDFDocument({ size: [folhaW, folhaH], margin: 0 });

  itens.forEach((item, idx) => {
    const slot = idx + (posicaoInicial - 1);
    const posInPage = slot % perPage;
    if (slot > posicaoInicial - 1 && posInPage === 0) {
      doc.addPage({ size: [folhaW, folhaH], margin: 0 });
    }

    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = margemX + col * (cellW + gapX);
    const y = margemY + row * (cellH + gapY);

    if (imprimirBorda) {
      doc.save();
      doc.lineWidth(0.3).strokeColor('#cccccc').rect(x, y, cellW, cellH).stroke();
      doc.restore();
    }

    desenharEtiqueta(doc, modelo, item, x, y, cellW, cellH);
  });

  return doc;
}
