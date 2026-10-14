const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * Gera um par de chaves Ed25519 para o evento
 */
function generateEventKeyPair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

/**
 * Assina digitalmente o ingresso e devolve o payload + imagem em Base64
 */
async function generateEncryptedTicketQR(ticketId, batchId, privateKeyPem) {
  const timestamp = Math.floor(Date.now() / 1000);
  const dataToSign = `${ticketId}:${batchId}:${timestamp}`;

  // Cria a assinatura digital usando a Chave Privada do evento
  const signature = crypto.sign(null, Buffer.from(dataToSign), privateKeyPem).toString('hex');

  // Payload final contido no QR Code
  const qrPayload = `${ticketId}:${batchId}:${timestamp}:${signature}`;

  // Gera a imagem do QR Code
  const qrCodeImage = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300
  });

  return { qrPayload, qrCodeImage, dataToSign };
}

module.exports = { generateEventKeyPair, generateEncryptedTicketQR };