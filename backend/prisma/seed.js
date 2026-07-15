import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function main() {
  const jaExiste = await prisma.user.count();
  if (jaExiste > 0) {
    console.log('Seed ignorado (banco já possui dados).');
    return;
  }

  // Loja matriz + terminal de PDV
  const matriz = await prisma.loja.create({
    data: { nome: 'Matriz', matriz: true, cidade: 'São Paulo', uf: 'SP' },
  });
  await prisma.pDVTerminal.create({
    data: { lojaId: matriz.id, nome: 'Caixa 01', identificador: 'PDV-001' },
  });

  const senhaHash = bcrypt.hashSync('admin123', 10);
  await prisma.user.create({
    data: { nome: 'Administrador', email: 'admin@seixastec.local', senhaHash, role: 'ADMIN', lojaId: matriz.id },
  });
  console.log('Usuário admin criado: admin@seixastec.local / admin123');

  // Configuração fiscal padrão
  await prisma.configuracaoFiscal.create({
    data: { id: 'singleton', origemMercadoria: '0', csosn: '102', cfop: '5102' },
  });

  // Financeiro: conta bancária padrão + plano de contas (categorias do DRE)
  await prisma.contaBancaria.create({
    data: { nome: 'Caixa', tipo: 'DINHEIRO', saldoInicial: 0, saldo: 0 },
  });
  await prisma.categoriaFinanceira.createMany({
    data: [
      { nome: 'Vendas de Produtos', grupo: 'RECEITA_OPERACIONAL', tipo: 'RECEITA' },
      { nome: 'Mercadoria/Fornecedores', grupo: 'CUSTO_OPERACIONAL', tipo: 'DESPESA' },
      { nome: 'Aluguel', grupo: 'DESPESA_OPERACIONAL', tipo: 'DESPESA' },
      { nome: 'Salários', grupo: 'DESPESA_OPERACIONAL', tipo: 'DESPESA' },
      { nome: 'Água/Energia/Internet', grupo: 'DESPESA_OPERACIONAL', tipo: 'DESPESA' },
      { nome: 'Taxas de Cartão/Tarifas Bancárias', grupo: 'DESPESA_FINANCEIRA', tipo: 'DESPESA' },
      { nome: 'Outras Receitas', grupo: 'OUTRAS_RECEITAS', tipo: 'RECEITA' },
      { nome: 'Outras Despesas', grupo: 'OUTRAS_DESPESAS', tipo: 'DESPESA' },
    ],
  });

  // Escalas de tamanho
  const escalaLetras = await prisma.escalaTamanho.create({
    data: { nome: 'PP-XG', tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'XG'], ordem: 1 },
  });
  await prisma.escalaTamanho.create({
    data: { nome: '36-46', tamanhos: ['36', '38', '40', '42', '44', '46'], ordem: 2 },
  });
  await prisma.escalaTamanho.create({
    data: { nome: 'Único', tamanhos: ['U'], ordem: 3 },
  });

  // Paleta de cores
  await prisma.cor.createMany({
    data: [
      { nome: 'Amarelo', hex: '#f59e0b', ordem: 1 },
      { nome: 'Azul', hex: '#2563eb', ordem: 2 },
      { nome: 'Bege', hex: '#d6c7a1', ordem: 3 },
      { nome: 'Branco', hex: '#f3f4f6', ordem: 4 },
      { nome: 'Preto', hex: '#111827', ordem: 5 },
      { nome: 'Rosa', hex: '#ec4899', ordem: 6 },
      { nome: 'Verde', hex: '#16a34a', ordem: 7 },
      { nome: 'Vermelho', hex: '#dc2626', ordem: 8 },
    ],
  });

  const [camisetas, calcas, vestidos] = await Promise.all([
    prisma.categoria.create({ data: { nome: 'Camisetas' } }),
    prisma.categoria.create({ data: { nome: 'Calças' } }),
    prisma.categoria.create({ data: { nome: 'Vestidos' } }),
  ]);
  const [hering, levis] = await Promise.all([
    prisma.marca.create({ data: { nome: 'Hering' } }),
    prisma.marca.create({ data: { nome: "Levi's" } }),
  ]);

  const tamanhos = ['P', 'M', 'G', 'GG'];
  const cores = ['Preto', 'Branco', 'Azul'];
  let seq = 1;

  function variacoes(nome) {
    const out = [];
    for (const t of tamanhos) {
      for (const c of cores) {
        out.push({
          tamanho: t,
          cor: c,
          sku: `${nome.slice(0, 4).toUpperCase()}-${t}-${c.slice(0, 3).toUpperCase()}`,
          codigoBarras: '2' + String(1000000000000 + seq++).slice(-12),
          estoqueAtual: 10,
          estoqueMinimo: 3,
        });
      }
    }
    return out;
  }

  const fiscal = { ncm: '61091000', origemMercadoria: '0', csosn: '102', cfop: '5102' };

  await prisma.produto.create({
    data: {
      referencia: 'CAM-001', nome: 'Camiseta Básica Gola Redonda',
      categoriaId: camisetas.id, marcaId: hering.id, escalaId: escalaLetras.id,
      genero: 'Unissex', colecao: 'Casual', estacao: 'Verão 2026',
      ...fiscal, precoCusto: 19.9, precoVenda: 49.9,
      variacoes: { create: variacoes('Camiseta') },
    },
  });
  await prisma.produto.create({
    data: {
      referencia: 'CAL-001', nome: 'Calça Jeans Slim',
      categoriaId: calcas.id, marcaId: levis.id, escalaId: escalaLetras.id,
      genero: 'Masculino', colecao: 'Denim', estacao: 'Inverno 2026',
      ncm: '62034200', origemMercadoria: '0', csosn: '102', cfop: '5102',
      precoCusto: 79.9, precoVenda: 199.9,
      variacoes: { create: variacoes('Calca') },
    },
  });
  await prisma.produto.create({
    data: {
      referencia: 'VES-001', nome: 'Vestido Midi Floral',
      categoriaId: vestidos.id, escalaId: escalaLetras.id,
      genero: 'Feminino', colecao: 'Alto Verão', estacao: 'Verão 2026',
      ncm: '62044200', origemMercadoria: '0', csosn: '102', cfop: '5102',
      precoCusto: 59.9, precoVenda: 149.9,
      variacoes: { create: variacoes('Vestido') },
    },
  });

  await prisma.cliente.create({ data: { nome: 'Consumidor Final' } });

  // Estoque por loja: cria o saldo da Matriz em EstoqueLocal (fonte de verdade
  // do saldo) E o movimento de ENTRADA "estoque inicial" correspondente. O
  // movimento é o LOG que permite a um edge reconstruir o EstoqueLocal por sync.
  const todasVariacoes = await prisma.variacao.findMany({ select: { id: true, estoqueAtual: true, estoqueMinimo: true } });
  await prisma.estoqueLocal.createMany({
    data: todasVariacoes.map((v) => ({
      lojaId: matriz.id,
      variacaoId: v.id,
      estoqueAtual: v.estoqueAtual,
      estoqueMinimo: v.estoqueMinimo,
    })),
    skipDuplicates: true,
  });
  await prisma.movimentacaoEstoque.createMany({
    data: todasVariacoes
      .filter((v) => v.estoqueAtual > 0)
      .map((v) => ({
        variacaoId: v.id,
        lojaId: matriz.id,
        tipo: 'ENTRADA',
        quantidade: v.estoqueAtual,
        motivo: 'Estoque inicial',
      })),
  });

  // Registra a Matriz como um edge na central (autenticação de sync + status).
  // O token bruto deve ser configurado no edge (EDGE_SYNC_TOKEN). Em dev usamos
  // um valor fixo para que central e edge compartilhem o mesmo segredo.
  const tokenMatriz = process.env.MATRIZ_EDGE_TOKEN || 'edge-matriz-dev-token';
  await prisma.edgeNode.upsert({
    where: { id: matriz.id },
    update: { nome: matriz.nome, tokenHash: sha256(tokenMatriz) },
    create: { id: matriz.id, nome: matriz.nome, tokenHash: sha256(tokenMatriz) },
  });
  console.log(`EdgeNode da Matriz criado. LOJA_ID=${matriz.id}  EDGE_SYNC_TOKEN=${tokenMatriz}`);

  console.log('Seed concluído com dados de exemplo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
