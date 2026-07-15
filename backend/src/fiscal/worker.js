// Worker fiscal: processa a fila de NotaFiscal PENDENTE, separado e
// independente do worker de sync (fala com a SEFAZ, não com a central —
// falha de um não deve afetar o outro).
import { prisma } from '../lib/prisma.js';
import { FISCAL_HABILITADO, LOJA_ID, assertFiscalConfig } from '../config.js';
import { montarXmlNfce } from './xml/nfce.js';
import { montarXmlNfe } from './xml/nfe.js';
import { assinarNfe } from './xml/assinatura.js';
import { enviarAutorizacaoNfce } from './soap/autorizacao.js';
import { enfileirar } from '../sync/outbox.js';

const INTERVALO_MS = Number(process.env.FISCAL_INTERVAL_MS || 20000);
const MAX_TENTATIVAS_REJEICAO = 3; // rejeição normalmente é erro de dado, não transitório

async function carregarConfiguracaoFiscal() {
  return prisma.configuracaoFiscal.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

async function processarNota(nota) {
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: nota.lojaId } });
  const configFiscal = await carregarConfiguracaoFiscal();

  let xml, chaveAcesso, idInfNFe, qrCodeUrl;
  if (nota.modelo === '55') {
    // NF-e manual (transferência/devolução/B2B) — sem Venda, dados vêm de dadosManual.
    ({ xml, chaveAcesso, idInfNFe } = montarXmlNfe({
      dadosManual: nota.dadosManual,
      loja,
      configFiscal,
      numero: nota.numero,
      serie: nota.serie,
      ambiente: nota.ambiente,
    }));
  } else {
    const venda = await prisma.venda.findUniqueOrThrow({
      where: { id: nota.vendaId },
      include: { itens: { include: { variacao: { include: { produto: true } } } }, pagamentos: true },
    });
    ({ xml, chaveAcesso, idInfNFe, qrCodeUrl } = montarXmlNfce({
      venda,
      loja,
      configFiscal,
      numero: nota.numero,
      serie: nota.serie,
      ambiente: nota.ambiente,
    }));
  }
  const xmlAssinado = assinarNfe(xml, idInfNFe, qrCodeUrl);

  const resultado = await enviarAutorizacaoNfce(xmlAssinado, { uf: loja.uf, ambiente: nota.ambiente, modelo: nota.modelo });

  if (resultado.autorizada) {
    const atualizada = await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: 'AUTORIZADA',
        chaveAcesso,
        protocolo: resultado.protocolo,
        xmlAssinado,
        xmlRetorno: resultado.xmlRetorno,
        qrCodeUrl,
        autorizadaEm: new Date(),
        tentativas: { increment: 1 },
      },
    });
    await enfileirar(prisma, 'nota_fiscal', atualizada.id, atualizada);
    console.log(`[fiscal] ${nota.modelo === '55' ? 'NF-e' : 'NFC-e'} ${nota.serie}/${nota.numero} autorizada (protocolo ${resultado.protocolo}).`);
    return;
  }

  // Rejeição: não é erro transitório de rede — para de tentar depois de
  // algumas rodadas e deixa marcado para revisão manual (ver rotas /reenviar).
  const tentativas = nota.tentativas + 1;
  const atualizada = await prisma.notaFiscal.update({
    where: { id: nota.id },
    data: {
      status: tentativas >= MAX_TENTATIVAS_REJEICAO ? 'REJEITADA' : 'PENDENTE',
      motivoRejeicao: `${resultado.cStat} - ${resultado.xMotivo}`,
      xmlRetorno: resultado.xmlRetorno,
      tentativas,
    },
  });
  if (atualizada.status === 'REJEITADA') {
    await enfileirar(prisma, 'nota_fiscal', atualizada.id, atualizada);
  }
  const situacao = tentativas >= MAX_TENTATIVAS_REJEICAO ? 'rejeitada (sem mais tentativas)' : 'rejeitada, tentando de novo no próximo ciclo';
  console.warn(`[fiscal] ${nota.modelo === '55' ? 'NF-e' : 'NFC-e'} ${nota.serie}/${nota.numero} ${situacao}: ${resultado.cStat} ${resultado.xMotivo}`);
}

let rodando = false;
async function ciclo() {
  if (rodando) return;
  rodando = true;
  try {
    const pendentes = await prisma.notaFiscal.findMany({
      where: { status: 'PENDENTE', lojaId: LOJA_ID },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    for (const nota of pendentes) {
      try {
        await processarNota(nota);
      } catch (err) {
        // Falha de rede/SEFAZ fora do ar: mantém PENDENTE, tenta de novo no
        // próximo ciclo — a venda em si já está finalizada e não é afetada.
        await prisma.notaFiscal.update({
          where: { id: nota.id },
          data: { tentativas: { increment: 1 } },
        }).catch(() => {});
        console.warn(`[fiscal] falha ao processar nota ${nota.id}: ${err.message}`);
      }
    }
  } finally {
    rodando = false;
  }
}

export function iniciarWorkerFiscal() {
  if (!FISCAL_HABILITADO) {
    console.log('[fiscal] FISCAL_HABILITADO=false — worker fiscal não iniciado (vendas funcionam normalmente sem emissão).');
    return;
  }
  assertFiscalConfig();
  console.log(`[fiscal] worker fiscal iniciado (loja=${LOJA_ID}, intervalo=${INTERVALO_MS}ms).`);
  setTimeout(ciclo, 5000);
  setInterval(ciclo, INTERVALO_MS);
}
