// Assinatura digital XML-DSig da NFC-e/NF-e, no formato exigido pela SEFAZ:
// assinatura "enveloped" do elemento <infNFe>, C14N padrão (não exclusivo),
// SHA-1 (sim, SHA-1 mesmo — é o que o layout 4.00 exige, apesar de datado).
import { SignedXml } from 'xml-crypto';
import { carregarCertificado } from '../certificado.js';
import { URL_CONSULTA_CHAVE } from '../qrcode.js';

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

// @param {string} xml - XML sem assinatura, contendo <infNFe Id="NFe...">
// @param {string} idInfNFe - valor do atributo Id de infNFe (ex.: "NFe4333...")
// @param {string} [qrCodeUrl] - se informado, insere <infNFeSupl> ENTRE
//   infNFe e Signature (ordem exigida pelo schema — confirmado contra a
//   implementação de referência sped-nfe: infNFe → infNFeSupl → Signature).
export function assinarNfe(xml, idInfNFe, qrCodeUrl) {
  const { chavePrivadaPem, certificadoPem } = carregarCertificado();

  const sig = new SignedXml({
    privateKey: chavePrivadaPem,
    publicCert: certificadoPem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N,
  });

  sig.addReference({
    xpath: `//*[local-name(.)='infNFe' and @Id='${idInfNFe}']`,
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
    uri: `#${idInfNFe}`,
  });

  sig.computeSignature(xml, {
    location: {
      reference: `//*[local-name(.)='infNFe']`,
      action: 'after',
    },
  });

  let xmlAssinado = sig.getSignedXml();

  if (qrCodeUrl) {
    const infNFeSupl = `<infNFeSupl><qrCode><![CDATA[${qrCodeUrl}]]></qrCode><urlChave>${URL_CONSULTA_CHAVE}</urlChave></infNFeSupl>`;
    xmlAssinado = xmlAssinado.replace('<Signature', `${infNFeSupl}<Signature`);
  }

  return xmlAssinado;
}

// Assinatura genérica de eventos (cancelamento, inutilização): mesmo esquema
// da NFe, mas assina o elemento com o Id informado (ex.: <infEvento Id="...">
// ou <infInut Id="...">), inserido logo depois dele.
export function assinarElemento(xml, elementoLocalName, id) {
  const { chavePrivadaPem, certificadoPem } = carregarCertificado();

  const sig = new SignedXml({
    privateKey: chavePrivadaPem,
    publicCert: certificadoPem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N,
  });

  sig.addReference({
    xpath: `//*[local-name(.)='${elementoLocalName}' and @Id='${id}']`,
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
    uri: `#${id}`,
  });

  sig.computeSignature(xml, {
    location: {
      reference: `//*[local-name(.)='${elementoLocalName}']`,
      action: 'after',
    },
  });

  return sig.getSignedXml();
}
