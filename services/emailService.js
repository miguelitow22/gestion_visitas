const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function enviarCorreo(destinatario, asunto, mensaje, htmlMensaje = null) {
    try {
        if (!destinatario) {
            console.warn("❌ [LOG] No se proporcionó un correo válido para enviar.");
            return { success: false, message: "Correo inválido" };
        }

        console.log(`📩 [LOG] Intentando enviar correo a ${destinatario} con el asunto: "${asunto}"`);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: destinatario,
            subject: asunto,
            text: mensaje,
            html: htmlMensaje || `<p>${mensaje}</p>`
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('✅ [LOG] Correo enviado:', info.response);
        
        return { success: true, message: 'Correo enviado con éxito' };
    } catch (error) {
        console.error('❌ [LOG] Error enviando correo:', error);
        return { success: false, message: error.message };
    }
}

module.exports = { enviarCorreo };
