// Credita automaticamente a conta bancária "principal" (configurada pelo usuário)
// com os recebíveis que já nascem como RECEBIDO mas sem contaBancariaId — hoje,
// isso acontece com vendas em DINHEIRO (ver vendas.routes.js e sync/apply.js).
export async function creditarRecebiveisSemConta(tx, recebiveis) {
  const semConta = (recebiveis || []).filter(
    (r) => r.status === 'RECEBIDO' && r.contaBancariaId == null
  );
  if (semConta.length === 0) return;

  const conta = await tx.contaBancaria.findFirst({ where: { principal: true, ativo: true } });
  if (!conta) return; // sem conta principal configurada, mantém sem vínculo (não é erro)

  let totalSomado = 0;
  for (const r of semConta) {
    await tx.recebivel.update({ where: { id: r.id }, data: { contaBancariaId: conta.id } });
    totalSomado += Number(r.valorLiquido);
  }

  await tx.contaBancaria.update({
    where: { id: conta.id },
    data: { saldo: { increment: totalSomado } },
  });
}
