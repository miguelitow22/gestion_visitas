const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { enviarCorreo } = require('../services/emailService');  
const { enviarWhatsApp } = require('../services/whatsappService');  
require('dotenv').config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configuración de Multer para recibir archivos con el campo "file"
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
});

// ✅ Enviar correo con manejo de errores
async function enviarCorreoSeguro(destinatario, asunto, mensaje, caso_id) {
    try {
        const resultado = await enviarCorreo(destinatario, asunto, mensaje);
        await supabase.from('comunicaciones').insert([{ caso_id, tipo: 'Correo', estado: resultado.success ? 'Enviado' : 'Fallido', comentario: resultado.message }]);
        return resultado;
    } catch (error) {
        console.error('❌ Error enviando correo:', error);
        await supabase.from('comunicaciones').insert([{ caso_id, tipo: 'Correo', estado: 'Fallido', comentario: error.message }]);
        return null;
    }
}

// ✅ Enviar WhatsApp con manejo de errores
async function enviarWhatsAppSeguro(telefono, mensaje, caso_id) {
    try {
        const resultado = await enviarWhatsApp(telefono, mensaje);
        await supabase.from('comunicaciones').insert([{ caso_id, tipo: 'WhatsApp', estado: resultado.success ? 'Enviado' : 'Fallido', comentario: resultado.message }]);
        return resultado;
    } catch (error) {
        console.error('❌ Error enviando WhatsApp:', error);
        await supabase.from('comunicaciones').insert([{ caso_id, tipo: 'WhatsApp', estado: 'Fallido', comentario: error.message }]);
        return null;
    }
}

// ✅ Ruta para enviar correo
router.post('/correo', async (req, res) => {
    const { email, asunto, mensaje, caso_id } = req.body;

    if (!email || !asunto || !mensaje) {
        return res.status(400).json({ error: 'Se requiere email, asunto y mensaje' });
    }

    console.log(`📩 Intentando enviar correo a ${email}...`);
    const resultado = await enviarCorreoSeguro(email, asunto, mensaje, caso_id);

    if (resultado && resultado.success) {
        return res.status(200).json({ message: "Correo enviado con éxito" });
    } else {
        return res.status(500).json({ error: resultado ? resultado.message : 'Error desconocido en el envío de correo' });
    }
});

// ✅ Ruta para enviar WhatsApp
router.post('/notificar', async (req, res) => {
    const { telefono, mensaje, caso_id } = req.body;

    if (!telefono || !mensaje) {
        return res.status(400).json({ error: 'Se requiere teléfono y mensaje' });
    }

    console.log(`📩 Intentando enviar WhatsApp a ${telefono}...`);
    const resultado = await enviarWhatsAppSeguro(telefono, mensaje, caso_id);

    if (resultado && resultado.success) {
        return res.status(200).json({ message: "WhatsApp enviado con éxito" });
    } else {
        return res.status(500).json({ error: resultado ? resultado.message : 'Error desconocido en el envío de WhatsApp' });
    }
});

// ✅ Ruta para subir evidencia y enviar notificaciones

router.post('/:id/evidencia', upload.single('file'), async (req, res) => {
    const { id } = req.params;

    if (!req.file) return res.status(400).json({ error: 'No se proporcionó un archivo' });

    try {
        console.log("📌 Subiendo evidencia...");

        const filePath = `evidencias_visitas/${id}_${Date.now()}${path.extname(req.file.originalname)}`;
        const { error: uploadError } = await supabase.storage
            .from('evidencias_visitas')
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('evidencias_visitas').getPublicUrl(filePath);
        if (!data.publicURL) throw new Error("No se pudo obtener la URL pública de la evidencia.");

        console.log(`✅ Evidencia subida correctamente: ${data.publicURL}`);

        const { error: updateError } = await supabase
            .from('casos')
            .update({ evidencia_url: data.publicURL })
            .eq('id', id)
            .select();

        if (updateError) throw updateError;

        res.json({ message: 'Evidencia subida y notificaciones enviadas', url: data.publicURL });
    } catch (error) {
        console.error('❌ Error al subir la evidencia:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/evidencia', upload.single('file'), async (req, res) => {
    const { id } = req.params;

    if (!req.file) return res.status(400).json({ error: 'No se proporcionó un archivo' });

    try {
        console.log("📌 Subiendo evidencia...");

        const filePath = `evidencias_visitas/${id}_${Date.now()}${path.extname(req.file.originalname)}`;
        const { error: uploadError } = await supabase.storage
            .from('evidencias_visitas')
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('evidencias_visitas').getPublicUrl(filePath);
        if (!data.publicURL) throw new Error("No se pudo obtener la URL pública de la evidencia.");

        console.log(`✅ Evidencia subida correctamente: ${data.publicURL}`);

        const { error: updateError } = await supabase
            .from('casos')
            .update({ evidencia_url: data.publicURL })
            .eq('id', id)
            .select();

        if (updateError) throw updateError;

        res.json({ message: 'Evidencia subida y notificaciones enviadas', url: data.publicURL });
    } catch (error) {
        console.error('❌ Error al subir la evidencia:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
