const crypto = require('crypto');
const { getLocalTicket, markTicketUsed } = require('./databaseService');

// Chave Pública do Evento (Usada para validar assinaturas sem internet)
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAX...
-----END PUBLIC KEY-----`;

/**
 * Valida o QR Code lido pela portaria
 */
function validateQRCode(qrPayload, publicKeyPem = PUBLIC_KEY_PEM) {
  try {
    const parts = qrPayload.trim().split(':');
    if (parts.length < 4) {
      return { success: false, reason: 'INVALID_FORMAT', message: 'Formato de QR Code inválido!' };
    }

    const [ticketId, batchId, timestampStr, signature] = parts;
    const dataToVerify = `${ticketId}:${batchId}:${timestampStr}`;

    // 1. Validação Criptográfica Assíncrona via Ed25519 (Offline)
    const isSignatureValid = crypto.verify(
      null,
      Buffer.from(dataToVerify),
      publicKeyPem,
      Buffer.from(signature, 'hex')
    );

    if (!isSignatureValid) {
      return { success: false, reason: 'FORGED_TICKET', message: '⛔ INGRESSO FALSIFICADO OU ADULTERADO!' };
    }

    // 2. Validação no Banco Local SQLite
    const ticketLocal = getLocalTicket(ticketId);

    if (ticketLocal && ticketLocal.status === 'used') {
      return { 
        success: false, 
        reason: 'ALREADY_USED', 
        message: `⛔ INGRESSO JÁ UTILIZADO em ${new Date(ticketLocal.used_at).toLocaleTimeString()}` 
      };
    }

    // 3. Marca como utilizado localmente
    markTicketUsed(ticketId);

    return { 
      success: true, 
      message: '✅ ENTRADA LIBERADA!',
      holderName: ticketLocal ? ticketLocal.holder_name : 'Visitante'
    };

  } catch (error) {
    console.error('Erro na validação:', error);
    return { success: false, reason: 'ERROR', message: 'Erro ao processar leitura.' };
  }
}

module.exports = { validateQRCode };
