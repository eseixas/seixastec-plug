# Checklist — saída de homologação para produção (NFC-e/NF-e)

Este documento cobre o que precisa ser conferido/trocado antes de emitir a primeira nota **real** (com valor fiscal). Homologação e produção usam a mesma infraestrutura de código — só a configuração muda.

## 1. Ambiente

- [ ] Em **Configurações → Configurações Fiscais**, trocar "Ambiente de emissão" de `Homologação` para `Produção`.
- [ ] Confirmar que a série de produção é a que a loja realmente vai usar (pode ser diferente da série de testes de homologação — evita misturar numeração de teste com numeração real).
- [ ] Zerar/confirmar o próximo número da série de produção antes da primeira venda real (a numeração é `max(numero)+1` por loja+modelo+série — se a série de produção nunca foi usada, começa em 1 automaticamente).

## 2. Certificado e credenciais

- [ ] Certificado A1 válido e **não vencido** (checar em Configurações → Certificado digital, ou `GET /api/fiscal/certificado/status`).
- [ ] `FISCAL_CERT_SENHA`, `FISCAL_CSC`, `FISCAL_ID_CSC` no `.env.edge` são os valores de **produção** (o CSC de homologação é diferente do de produção — gerar no portal da SEFAZ-RJ, aba de credenciamento, ambiente produção).
- [ ] Reiniciar o container do edge depois de trocar qualquer uma dessas três variáveis (elas só são lidas na inicialização, diferente do arquivo do certificado que pode ser trocado a quente pela UI).

## 3. Dados cadastrais da loja

- [ ] CNPJ, IE, CRT (regime tributário) e endereço da `Loja` conferem com o cadastro na Receita/SEFAZ.
- [ ] Código IBGE do município (`codigoMunicipioIbge`) preenchido corretamente — sem ele a emissão falha (cStat 225).
- [ ] **Atenção**: editar esses campos sempre na **central** (fonte de verdade), nunca só no edge — o edge é read-only replica desses dados e pode ser sobrescrito no próximo pull se editado só localmente (ver incidente registrado durante o desenvolvimento).
- [ ] Cuidado com caracteres acentuados ao editar via terminal/curl no Windows — use um arquivo UTF-8 (`--data-binary @arquivo.json`) em vez de passar a string direto na linha de comando, ou edite pela tela do admin (React já lida com UTF-8 corretamente).

## 4. Regras de negócio específicas descobertas durante o desenvolvimento (não presumir, conferir se mudaram)

- [ ] Item 1 da nota **não** deve mais usar o texto fixo de homologação em produção (`montarXmlNfce` já troca isso automaticamente com base no campo `ambiente` — conferir que está usando `ambiente: 'producao'`).
- [ ] Pagamentos por PIX/cartão (tPag 03/04/17) exigem o grupo `<card>` desde a NT 2025.001 — já implementado, mas se a SEFAZ atualizar a regra de novo, checar `backend/src/fiscal/xml/nfce.js`.
- [ ] QR Code usa a versão 3 (NT 2025.001) — URL simples `?p=<chave>|3|<tpAmb>` para emissão online, sem CSC no próprio QR Code (o CSC é usado apenas na autenticação/credenciamento, não no QR Code v3). Confirmar se a SEFAZ ainda aceita essa versão perto da virada para produção.
- [ ] `urlChave` do RJ é `www.fazenda.rj.gov.br/nfce/consulta` (sem `https://`, conforme registrado do lado da SVRS) — validar contra `github.com/nfephp-org/sped-nfe` (`storage/uri_consulta_nfce.json`) se a SEFAZ trocar de novo (já mudou pelo menos duas vezes desde 2023 pelo histórico público).
- [ ] `SOAPAction` é obrigatório no header `Content-Type` para `RecepcaoEvento4` (cancelamento) e `NFeInutilizacao4` — os nomes de operação e a capitalização exata do namespace (`NFeRecepcaoEvento4`, `NFeInutilizacao4` — atenção às maiúsculas) importam; confirmar contra o WSDL se algo mudar (`?wsdl` no endpoint).
- [ ] Prazo de cancelamento: o código usa uma checagem "soft" de 24h (`PRAZO_CANCELAMENTO_HORAS` em `backend/src/routes/fiscal.routes.js`), mas quem decide de verdade é a SEFAZ (cStat 501 = prazo expirado). Confirmar o prazo real vigente para NFC-e no RJ antes de contar com essa janela operacionalmente.
- [ ] **NF-e (55) usa hosts SVRS diferentes da NFC-e** — `nfe(-homologacao).svrs.rs.gov.br`, não `nfce(-homologacao)...` — já implementado em `backend/src/fiscal/soap/cliente.js` (`baseHost` por modelo), mas se a loja mudar de UF/provedor, conferir que os dois modelos continuam com hosts corretos.
- [ ] NF-e (diferente de NFC-e) exige o grupo `<pag>` mesmo sem movimentação financeira — usamos `tPag=90` ("Sem pagamento") para transferência/devolução em `backend/src/fiscal/xml/nfe.js`. Se um dia a NF-e manual cobrir venda B2B com pagamento real, trocar para o `tPag` correto.
- [ ] Regra de homologação da NF-e é **diferente** da NFC-e: não é o item 1 que precisa do texto fixo, é a **razão social do destinatário** (`dest/xNome` = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL", cStat 598 se errado).
- [ ] `indIntermed` (indicativo de intermediador/marketplace) é obrigatório desde a NT2020.006 — usamos sempre `0` (sem intermediador) já que não há emissão via marketplace nesta implementação.
- [ ] Destinatário não-contribuinte (`indIEDest=9`, sem IE) força `indFinal=1` (consumidor final) — a SEFAZ rejeita (cStat 696) se um não-contribuinte for marcado como não-consumidor-final. Já tratado dinamicamente em `nfe.js`, mas se destinatário for CNPJ contribuinte, a **IE é obrigatória** (cStat 232 se ausente) — a tela de emissão manual não valida isso hoje, só a SEFAZ acusa no retorno.

## 5. Testes obrigatórios antes de liberar para o caixa

- [ ] Emitir 1 venda de teste em produção com valor baixo (ex.: R$ 1,00) e conferir autorização + DANFCE.
- [ ] Testar 1 cancelamento em produção.
- [ ] Confirmar que a venda aparece corretamente na tela de Notas Fiscais da central (sync edge→central).
- [ ] Confirmar que uma venda comum (sem produtos fiscalmente incompletos) não gera erro de NCM/CFOP ausente.

## 6. Contingência e limitações conhecidas (não implementadas nesta fase)

- [ ] Contingência formal offline (modo `tpEmis=9`, para quando a SEFAZ fica fora do ar por período prolongado) **não está implementada** — hoje, se a SEFAZ estiver fora do ar, a nota fica `PENDENTE` na fila e é reenviada automaticamente quando a conexão voltar. Isso cobre a maioria dos casos práticos, mas não é o mecanismo formal exigido pela legislação para indisponibilidade prolongada.
- [ ] NF-e (modelo 55) para operações manuais (transferência entre lojas, devolução a fornecedor, venda B2B) ainda não tem tela de emissão no admin — a infraestrutura (assinatura, transmissão, fila) é compartilhada com a NFC-e e está pronta, falta o formulário e o XML específico do modelo 55 com destinatário.
- [ ] Regime Normal (CRT=3) não foi implementado no XML — hoje só o bloco ICMS Simples Nacional (`ICMSSN102`) é montado. Se alguma loja migrar para Regime Normal, `backend/src/fiscal/xml/nfce.js` precisa de um bloco `ICMS00`/`ICMS40` etc. com CST em vez de CSOSN.
