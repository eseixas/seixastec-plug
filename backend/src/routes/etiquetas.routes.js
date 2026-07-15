import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { gerarCodigoBarras } from '../lib/codigoBarras.js';
import { gerarImagemBarcode } from '../lib/barcodeImage.js';
import { gerarPdfTermica, gerarPdfA4 } from '../etiquetas/pdf.js';

const router = Router();

const pdfSchema = z.object({
  itens: z
    .array(
      z.object({
        variacaoId: z.string().min(1),
        quantidade: z.coerce.number().int().min(1),
      })
    )
    .min(1),
  formato: z.enum(['termica', 'a4']),
});

router.post(
  '/pdf',
  asyncHandler(async (req, res) => {
    const { itens, formato } = pdfSchema.parse(req.body);

    // 1. Carrega as variações e garante que todas tenham código de barras
    // (gera e persiste o que faltar), tudo numa transação.
    const variacoes = await prisma.$transaction(async (tx) => {
      const mapa = new Map();
      for (const { variacaoId } of itens) {
        if (mapa.has(variacaoId)) continue;
        let variacao = await tx.variacao.findUnique({
          where: { id: variacaoId },
          include: { produto: true },
        });
        if (!variacao) {
          throw Object.assign(new Error(`Variação não encontrada: ${variacaoId}`), { status: 404 });
        }
        if (!variacao.codigoBarras) {
          const codigo = await gerarCodigoBarras(tx);
          variacao = await tx.variacao.update({
            where: { id: variacaoId },
            data: { codigoBarras: codigo },
            include: { produto: true },
          });
        }
        mapa.set(variacaoId, variacao);
      }
      return mapa;
    });

    // 2. Cache de imagens de barcode por código (evita re-gerar quando
    // quantidade > 1 ou o mesmo código aparece em vários itens).
    const imagensPorCodigo = new Map();
    async function imagemDe(codigo) {
      if (!imagensPorCodigo.has(codigo)) {
        imagensPorCodigo.set(codigo, await gerarImagemBarcode(codigo));
      }
      return imagensPorCodigo.get(codigo);
    }

    // 3. Lista achatada: uma entrada por etiqueta física.
    const flat = [];
    for (const { variacaoId, quantidade } of itens) {
      const v = variacoes.get(variacaoId);
      const precoVenda = v.precoVenda ?? v.produto.precoVenda;
      const barcodeImageBuffer = await imagemDe(v.codigoBarras);
      for (let i = 0; i < quantidade; i++) {
        flat.push({
          produtoNome: v.produto.nome,
          cor: v.cor,
          tamanho: v.tamanho,
          precoVenda,
          codigoBarras: v.codigoBarras,
          barcodeImageBuffer,
        });
      }
    }

    // 4. Monta o PDF conforme o formato e faz stream pra resposta.
    const doc = formato === 'a4' ? await gerarPdfA4(flat) : await gerarPdfTermica(flat);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="etiquetas.pdf"');
    doc.pipe(res);
    doc.end();
  })
);

export default router;
