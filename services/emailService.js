const nodemailer = require('nodemailer');
require('dotenv').config();

// ✅ Verificación de credenciales de correo
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ [LOG] ERROR: Falta configurar las credenciales de correo en las variables de entorno.");
    process.exit(1); // Detiene la ejecución si no hay credenciales
}

// ✅ Configurar el transporte de correo con mejor seguridad
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    secure: true, // Usar conexión segura si es posible
    tls: {
        rejectUnauthorized: false // ⚠️ Considera cambiar esto en producción
    }
});

// ✅ Expresión regular para validar correos electrónicos
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function enviarCorreo(destinatario, asunto, mensaje, htmlMensaje = null) {
    try {
        if (!destinatario || !emailRegex.test(destinatario)) {
            console.warn("❌ [LOG] Dirección de correo inválida:", destinatario);
            return { success: false, message: "Correo inválido" };
        }

        console.log(`📩 [LOG] Intentando enviar correo a ${destinatario} con el asunto: "${asunto}"`);

        const mailOptions = {
            from: `"Notificaciones" <${process.env.EMAIL_USER}>`,
            to: destinatario,
            subject: asunto,
            text: mensaje,
            html: htmlMensaje || `<p>${mensaje}</p>`
        };

        let info = await transporter.sendMail(mailOptions);
        console.log(`✅ [LOG] Correo enviado a ${destinatario}:`, info.response);

        return { success: true, message: 'Correo enviado con éxito', response: info.response };
    } catch (error) {
        console.error(`❌ [LOG] Error enviando correo a ${destinatario}:`, error);
        return { success: false, message: error.message };
    }
}

module.exports = { enviarCorreo };
