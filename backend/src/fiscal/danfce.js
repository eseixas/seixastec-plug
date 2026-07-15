// DANFCE mínima: gera a imagem do QR Code a partir da URL já embutida no XML
// (ver ./qrcode.js, que é a fonte única da URL — usada tanto ao montar o XML
// quanto aqui para exibição, não devem divergir).
import QRCode from 'qrcode';
import { urlQrCode } from './qrcode.js';

export async function gerarDanfce({ chaveAcesso, ambiente }) {
  const qrCodeUrl = urlQrCode({ chaveAcesso, ambiente });
  const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);
  return { qrCodeUrl, qrCodeDataUrl };
}
