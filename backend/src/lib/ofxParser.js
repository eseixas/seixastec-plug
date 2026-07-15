// Parser mínimo de OFX (1.x SGML e 2.x XML) — sem dependência externa.
// Extrai as transações (<STMTTRN>) de um extrato bancário e retorna um array
// de { data: Date, valor: Number, descricao: string, fitId: string|null }.
//
// OFX 1.x é SGML: muitas tags não têm fechamento (ex.: `<TRNAMT>-10.00`), o
// valor vai até o fim da linha ou até a próxima tag. Tratamos ambos os casos
// com uma regex tolerante que captura o conteúdo até `<` ou quebra de linha.

// Converte DTPOSTED (YYYYMMDDHHMMSS[.xxx][tz] ou YYYYMMDD) para Date.
function parseOfxDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh = '00', mm = '00', ss = '00'] = m;
  // Interpreta como horário local (extratos brasileiros costumam vir sem tz).
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Extrai o valor de uma tag SGML/XML dentro de um bloco. Aceita tanto
// `<TAG>valor</TAG>` quanto `<TAG>valor` (sem fechamento, até `<` ou \n).
function extractTag(block, tag) {
  const re = new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i');
  const m = block.match(re);
  if (!m) return null;
  const v = m[1].trim();
  return v.length ? v : null;
}

export function parseOfx(conteudo) {
  if (!conteudo || typeof conteudo !== 'string') return [];

  const transacoes = [];
  // Captura cada bloco iniciado por <STMTTRN> até o próximo <STMTTRN>,
  // </STMTTRN>, </BANKTRANLIST> ou fim do texto.
  const blocoRe = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRN>|<\/BANKTRANLIST>|$)/gi;
  let match;
  while ((match = blocoRe.exec(conteudo)) !== null) {
    const bloco = match[1];

    const data = parseOfxDate(extractTag(bloco, 'DTPOSTED'));
    const valorRaw = extractTag(bloco, 'TRNAMT');
    if (data === null || valorRaw === null) continue;

    // Números OFX usam ponto decimal; alguns bancos exportam com vírgula.
    const valor = Number(String(valorRaw).replace(',', '.'));
    if (Number.isNaN(valor)) continue;

    // MEMO tem prioridade sobre NAME como descrição.
    const descricao = extractTag(bloco, 'MEMO') || extractTag(bloco, 'NAME') || '';
    const fitId = extractTag(bloco, 'FITID');

    transacoes.push({
      data,
      valor,
      descricao: String(descricao).trim(),
      fitId: fitId || null,
    });
  }

  return transacoes;
}

export default parseOfx;
