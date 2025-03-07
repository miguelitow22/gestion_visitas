const axios = require('axios');
require('dotenv').config();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// ✅ Verificar credenciales antes de enviar mensajes
if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error("❌ [LOG] ERROR: Faltan credenciales de WhatsApp en las variables de entorno.");
    throw new Error("Credenciales de WhatsApp no configuradas.");
}

// ✅ Expresión regular para validar número de teléfono en formato internacional
const phoneRegex = /^\+?\d{10,15}$/;

async function enviarWhatsApp(numero, mensaje) {
    try {
        // ✅ Validar número de teléfono
        if (!numero || !phoneRegex.test(numero)) {
            console.warn("❌ [LOG] Número de teléfono inválido:", numero);
            return { success: false, message: "Número inválido o formato incorrecto" };
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

        console.log(`✅ [LOG] Mensaje enviado con éxito a ${numero}:`, response.data);
        return { success: true, message: "Mensaje enviado con éxito", data: response.data };

    } catch (error) {
        const errorMsg = error.response?.data || error.message;
        console.error(`❌ [LOG] Error enviando WhatsApp a ${numero}:`, errorMsg);
        return { success: false, message: errorMsg, error: error.response?.data || null };
    }
}

/**
 * Envía un mensaje utilizando una plantilla aprobada.
 * @param {string} numero - Número del destinatario.
 * @param {string} templateName - Nombre de la plantilla aprobada.
 * @param {string} languageCode - Código del idioma (ej. "es").
 * @param {Array} params - Lista de parámetros para sustituir los placeholders de la plantilla.
 */
async function enviarWhatsAppTemplate(numero, templateName, languageCode, params) {
    try {
        // Validar número
        if (!numero || !phoneRegex.test(numero)) {
            console.warn("❌ [LOG] Número de teléfono inválido:", numero);
            return { success: false, message: "Número inválido o formato incorrecto" };
        }

        console.log(`📲 [LOG] Enviando mensaje de WhatsApp con plantilla a ${numero}`);

        // Convertir cada parámetro al formato requerido por la API
        const parameters = params.map(param => ({
            type: "text",
            text: param
        }));

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: numero,
            type: "template",
            template: {
                name: templateName,
                language: { code: languageCode },
                components: [
                    {
                        type: "body",
                        parameters: parameters
                    }
                ]
            }
        };

        const response = await axios.post(
            `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
            payload,
            {
                headers: {
                    "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`✅ [LOG] Mensaje plantilla enviado con éxito a ${numero}:`, response.data);
        return { success: true, message: "Mensaje enviado con éxito", data: response.data };

    } catch (error) {
        const errorMsg = error.response?.data || error.message;
        console.error(`❌ [LOG] Error enviando WhatsApp plantilla a ${numero}:`, errorMsg);
        return { success: false, message: errorMsg, error: error.response?.data || null };
    }
}

module.exports = { enviarWhatsApp, enviarWhatsAppTemplate };
