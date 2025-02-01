const axios = require('axios');
require('dotenv').config();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function enviarWhatsApp(numero, mensaje) {
    try {
        if (!numero) {
            console.warn("❌ [LOG] Número de teléfono no válido.");
            return { success: false, message: "Número inválido" };
        }

        console.log(`📲 [LOG] Enviando mensaje de WhatsApp a ${numero}: "${mensaje}"`);

        const response = await axios.post(
            `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: numero,
                type: "text",
                text: { body: mensaje }
            },
            {
                headers: {
                    "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`✅ [LOG] Mensaje enviado con éxito:`, response.data);
        return { success: true, message: "Mensaje enviado con éxito", data: response.data };

    } catch (error) {
        console.error(`❌ [LOG] Error enviando WhatsApp a ${numero}:`, error.response ? error.response.data : error.message);
        return { success: false, message: error.message, error: error.response ? error.response.data : null };
    }
}

module.exports = { enviarWhatsApp };
