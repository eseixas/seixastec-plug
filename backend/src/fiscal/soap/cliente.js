// Cliente HTTPS com mTLS (certificado do contribuinte) para os webservices
// SOAP da SEFAZ. Feito com https nativo (não uma lib SOAP genérica) porque os
// WSDLs da SEFAZ costumam ter atrito com libs SOAP prontas — ver plano.
//
// RJ usa o SVRS (Sefaz Virtual do Rio Grande do Sul) para NFC-e — confirmado
// em https://dfe-portal.svrs.rs.gov.br/Nfce/Servicos (jul/2026). Se a loja
// mudar de UF, os hosts abaixo (e o mapeamento de UF→ambiente em outros
// estados) precisam ser revistos.
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { carregarCertificado } from '../certificado.js';

// A cadeia de certificados dos webservices da SEFAZ é assinada pela raiz do
// ICP-Brasil (ITI), que NÃO faz parte do bundle padrão de CAs do Node — sem
// isso, toda chamada falha com "unable to get local issuer certificate"
// mesmo com o certificado do contribuinte correto. Raiz pública, sem segredo.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICP_BRASIL_RAIZ = fs.readFileSync(path.join(__dirname, '..', 'certs', 'icp-brasil-v10-raiz.pem'));

// Endpoints SVRS por ambiente. NFC-e (modelo 65) e NF-e (modelo 55) usam
// HOSTS DIFERENTES no SVRS (nfce.svrs.rs.gov.br vs nfe.svrs.rs.gov.br) —
// mandar um XML modelo 55 para o host de NFC-e é rejeitado pelo schema
// (cStat 225, sem indicar campo específico). RecepcaoEvento/Inutilizacao são
// compartilhados entre os dois modelos. Ajustar/expandir se a loja não for RJ.
const HOST_POR_MODELO = { 65: 'nfce', 55: 'nfe' };

function baseHost(ambiente, modelo) {
  const prefixo = HOST_POR_MODELO[modelo];
  if (!prefixo) throw new Error(`Modelo "${modelo}" sem host SVRS mapeado.`);
  const sufixo = ambiente === 'producao' ? '' : '-homologacao';
  return `https://${prefixo}${sufixo}.svrs.rs.gov.br`;
}

export function endpointFor(uf, ambiente, servico, modelo = '65') {
  if (uf !== 'RJ') {
    throw new Error(`UF "${uf}" não mapeada em ENDPOINTS_SVRS — confirmar se usa SVRS ou webservice próprio antes de emitir.`);
  }
  const host = baseHost(ambiente, modelo);
  const CAMINHOS = {
    StatusServico: '/ws/NfeStatusServico/NfeStatusServico4.asmx',
    Autorizacao: '/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    RetAutorizacao: '/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    ConsultaProtocolo: '/ws/NfeConsulta/NfeConsulta4.asmx',
    RecepcaoEvento: '/ws/recepcaoevento/recepcaoevento4.asmx',
    Inutilizacao: '/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  };
  const caminho = CAMINHOS[servico];
  if (!caminho) throw new Error(`Serviço "${servico}" sem endpoint mapeado.`);
  return host + caminho;
}

// Envia um envelope SOAP 1.2 já pronto (string XML) via mTLS com o certificado
// do edge. `soapAction` é o xmlns do serviço (WSDL), usado no envelope.
export function envelopeSoap12(servicoXmlns, corpoXml) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
    'xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap12:Body>' +
    `<nfeDadosMsg xmlns="${servicoXmlns}">${corpoXml}</nfeDadosMsg>` +
    '</soap12:Body>' +
    '</soap12:Envelope>'
  );
}

// POST via mTLS. Retorna o corpo bruto da resposta (XML SOAP) para o chamador
// extrair o retorno específico do serviço.
//
// `soapAction`, se informado, vai no parâmetro action do Content-Type (SOAP
// 1.2) — StatusServico/Autorizacao aceitaram sem isso (serviço com uma única
// operação), mas RecepcaoEvento4 (múltiplas operações) rejeita com HTTP 500
// "Unable to handle request without a valid action parameter" sem ele.
export function postSoap(url, envelopeXml, { timeoutMs = 20000, soapAction = null } = {}) {
  const { pfxBuffer, passphrase } = carregarCertificado();

  return new Promise((resolve, reject) => {
    const { hostname, pathname, search, port } = new URL(url);
    const contentType = soapAction
      ? `application/soap+xml; charset=utf-8; action="${soapAction}"`
      : 'application/soap+xml; charset=utf-8';
    const req = https.request(
      {
        hostname,
        path: `${pathname}${search}`,
        port: port || 443,
        method: 'POST',
        pfx: pfxBuffer,
        passphrase,
        ca: ICP_BRASIL_RAIZ,
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(envelopeXml),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Timeout ao chamar webservice da SEFAZ.')));
    req.on('error', reject);
    req.write(envelopeXml);
    req.end();
  });
}
