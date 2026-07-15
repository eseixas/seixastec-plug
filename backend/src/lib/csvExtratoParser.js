// Parser de CSV de extrato no formato fixo `data,valor,descricao`.
// - Separador vírgula, com suporte básico a campos entre aspas duplas.
// - Cabeçalho opcional: se a primeira linha não parsear como data válida, é
//   tratada como header e descartada.
// - Data em DD/MM/YYYY ou YYYY-MM-DD.
// Retorna { data: Date, valor: Number, descricao: string, fitId: null }.

// Divide uma linha CSV respeitando aspas duplas ("" = aspas escapada).
function splitCsvLine(line) {
  const campos = [];
  let atual = '';
  let dentroAspas = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (dentroAspas) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroAspas = false;
        }
      } else {
        atual += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === ',') {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((s) => s.trim());
}

// Converte DD/MM/YYYY ou YYYY-MM-DD para Date (horário local). null se inválida.
function parseCsvDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let y, mo, d;
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    [, d, mo, y] = m;
  } else {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      [, y, mo, d] = m;
    } else {
      return null;
    }
  }
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  // Valida que os componentes não "estouraram" (ex.: 31/02).
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) {
    return null;
  }
  return date;
}

// Converte um valor monetário textual (aceita "1.234,56" ou "1234.56" ou
// "-10,00") para Number. null se inválido.
function parseValor(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  // Formato brasileiro "1.234,56": remove pontos de milhar, troca vírgula por ponto.
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export function parseCsvExtrato(conteudo) {
  if (!conteudo || typeof conteudo !== 'string') return [];

  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhas.length === 0) return [];

  const transacoes = [];
  let primeira = true;

  for (const linha of linhas) {
    const campos = splitCsvLine(linha);
    const data = parseCsvDate(campos[0]);

    // Primeira linha sem data válida = cabeçalho, pula.
    if (primeira && data === null) {
      primeira = false;
      continue;
    }
    primeira = false;

    if (data === null) continue; // linha malformada, ignora
    const valor = parseValor(campos[1]);
    if (valor === null) continue;

    const descricao = (campos[2] || '').trim();
    transacoes.push({ data, valor, descricao, fitId: null });
  }

  return transacoes;
}

export default parseCsvExtrato;
