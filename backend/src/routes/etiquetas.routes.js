import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { gerarCodigoBarras } from '../lib/codigoBarras.js';
import { gerarImagemBarcode } from '../lib/barcodeImage.js';
import { gerarPdfComModelo } from '../etiquetas/pdf.js';

const router = Router();

const linhaConteudoSchema = z
  .object({
    campo: z.enum([
      'COMPANY_NAME',
      'PRODUCT_CODE',
      'PRODUCT_NAME',
      'PRODUCT_CODE_NAME',
      'PRODUCT_CATEGORY',
      'PRODUCT_VALUE',
      'TEXT',
    ]),
    texto: z.string().optional(),
  })
  .refine((l) => l.campo !== 'TEXT' || (l.texto && l.texto.length > 0), {
    message: 'O texto é obrigatório para o campo Texto.',
    path: ['texto'],
  });

const modeloSchema = z.object({
  nome: z.string().min(1),
  codigo: z.string().min(1),
  folhaLargura: z.coerce.number().positive(),
  folhaAltura: z.coerce.number().positive(),
  margemEsquerda: z.coerce.number().min(0).optional(),
  margemTopo: z.coerce.number().min(0).optional(),
  colunas: z.coerce.number().int().min(1),
  espacamentoColunas: z.coerce.number().min(0).optional(),
  linhasFolha: z.coerce.number().int().min(1),
  espacamentoLinhas: z.coerce.number().min(0).optional(),
  etiquetaLargura: z.coerce.number().positive(),
  etiquetaAltura: z.coerce.number().positive(),
  espacoSuperior: z.coerce.number().min(0).optional(),
  espacoInferior: z.coerce.number().min(0).optional(),
  espacoEsquerda: z.coerce.number().min(0).optional(),
  espacoDireita: z.coerce.number().min(0).optional(),
  linhasConteudo: z.array(linhaConteudoSchema).min(1),
  fonteTipo: z.enum(['Helvetica', 'Times', 'Courier']).optional(),
  fonteTamanho: z.coerce.number().int().min(4).max(12).optional(),
  alinhamento: z.enum(['L', 'C', 'R']).optional(),
  imagemLeituraTipo: z.enum(['NENHUMA', 'BARCODE', 'QRCODE']).optional(),
  ativo: z.boolean().optional(),
});

router.get('/modelos', asyncHandler(async (req, res) => {
  const modelos = await prisma.modeloEtiqueta.findMany({
    where: { ativo: true },
    orderBy: [{ nome: 'asc' }],
  });
  res.json(modelos);
}));

router.get('/modelos/:id', asyncHandler(async (req, res) => {
  const modelo = await prisma.modeloEtiqueta.findUnique({ where: { id: req.params.id } });
  if (!modelo) {
    throw Object.assign(new Error('Modelo de etiqueta não encontrado.'), { status: 404 });
  }
  res.json(modelo);
}));

router.post('/modelos', asyncHandler(async (req, res) => {
  const data = modeloSchema.parse(req.body);
  const modelo = await prisma.modeloEtiqueta.create({ data });
  res.status(201).json(modelo);
}));

router.put('/modelos/:id', asyncHandler(async (req, res) => {
  const data = modeloSchema.partial().parse(req.body);
  const modelo = await prisma.modeloEtiqueta.update({ where: { id: req.params.id }, data });
  res.json(modelo);
}));

router.delete('/modelos/:id', asyncHandler(async (req, res) => {
  await prisma.modeloEtiqueta.update({ where: { id: req.params.id }, data: { ativo: false } });
  res.status(204).end();
}));

const pdfSchema = z.object({
  itens: z
    .array(
      z.object({
        variacaoId: z.string().min(1),
        quantidade: z.coerce.number().int().min(1),
      })
    )
    .min(1),
  modeloId: z.string().min(1),
  posicaoInicial: z.coerce.number().int().min(1).optional().default(1),
  imprimirBorda: z.boolean().optional().default(false),
});

router.post(
  '/pdf',
  asyncHandler(async (req, res) => {
    const { itens, modeloId, posicaoInicial, imprimirBorda } = pdfSchema.parse(req.body);

    const modelo = await prisma.modeloEtiqueta.findUnique({ where: { id: modeloId } });
    if (!modelo || !modelo.ativo) {
      throw Object.assign(new Error('Modelo de etiqueta não encontrado.'), { status: 404 });
    }
    if (posicaoInicial > modelo.colunas * modelo.linhasFolha) {
      throw Object.assign(
        new Error('Posição inicial excede a quantidade de etiquetas por folha.'),
        { status: 400 }
      );
    }

    const companyName = (await prisma.loja.findFirst({ where: { matriz: true } }))?.nome || '';

    // Carrega as variações e garante que todas tenham código de barras
    // (gera e persiste o que faltar), tudo numa transação.
    const variacoes = await prisma.$transaction(async (tx) => {
      const mapa = new Map();
      for (const { variacaoId } of itens) {
        if (mapa.has(variacaoId)) continue;
        let variacao = await tx.variacao.findUnique({
          where: { id: variacaoId },
          include: { produto: { include: { categoria: true } } },
        });
        if (!variacao) {
          throw Object.assign(new Error(`Variação não encontrada: ${variacaoId}`), { status: 404 });
        }
        if (!variacao.codigoBarras) {
          const codigo = await gerarCodigoBarras(tx);
          variacao = await tx.variacao.update({
            where: { id: variacaoId },
            data: { codigoBarras: codigo },
            include: { produto: { include: { categoria: true } } },
          });
        }
        mapa.set(variacaoId, variacao);
      }
      return mapa;
    });

    // Cache da imagem de leitura por código (barcode/qr), evita re-gerar.
    const imagensPorCodigo = new Map();
    async function imagemDe(codigo) {
      if (modelo.imagemLeituraTipo === 'NENHUMA') return null;
      if (!imagensPorCodigo.has(codigo)) {
        const buffer =
          modelo.imagemLeituraTipo === 'QRCODE'
            ? await QRCode.toBuffer(codigo, { type: 'png', margin: 0 })
            : await gerarImagemBarcode(codigo);
        imagensPorCodigo.set(codigo, buffer);
      }
      return imagensPorCodigo.get(codigo);
    }

    // Lista achatada: uma entrada por etiqueta física.
    const flat = [];
    for (const { variacaoId, quantidade } of itens) {
      const v = variacoes.get(variacaoId);
      const precoVenda = v.precoVenda ?? v.produto.precoVenda;
      const codigo = v.produto.referencia ?? v.sku;
      const leituraImagemBuffer = await imagemDe(v.codigoBarras);
      for (let i = 0; i < quantidade; i++) {
        flat.push({
          produtoNome: v.produto.nome,
          codigo,
          categoria: v.produto.categoria?.nome || '',
          companyName,
          precoVenda,
          codigoBarras: v.codigoBarras,
          leituraImagemBuffer,
        });
      }
    }

    const doc = await gerarPdfComModelo(modelo, flat, { posicaoInicial, imprimirBorda });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="etiquetas.pdf"');
    doc.pipe(res);
    doc.end();
  })
);

export default router;
