const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { enviarCorreo } = require('../services/emailService');  
const { enviarWhatsApp } = require('../services/whatsappService');  
require('dotenv').config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Configuración de Multer para recibir archivos
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

// ✅ Expresión regular para validar correos electrónicos
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ✅ Expresión regular para validar números de teléfono en formato internacional
const phoneRegex = /^\+?\d{10,15}$/;

// ✅ Enviar correo con validaciones y manejo de errores mejorado
router.post('/correo', async (req, res) => {
    const { email, asunto, mensaje } = req.body;

    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    console.log(`📩 [LOG] Intentando enviar correo a ${email}...`);
    const resultado = await enviarCorreo(email, asunto, mensaje);

    if (resultado?.success) {
        return res.status(200).json({ message: "Correo enviado con éxito" });
    } else {
        return res.status(500).json({ error: resultado?.message || 'Error desconocido en el envío de correo' });
    }
});

// ✅ Enviar WhatsApp con validación mejorada
router.post('/notificar', async (req, res) => {
    const { telefono, mensaje } = req.body;

    if (!telefono || !phoneRegex.test(telefono)) {
        return res.status(400).json({ error: 'Número de teléfono inválido' });
    }

    console.log(`📩 [LOG] Intentando enviar WhatsApp a ${telefono}...`);
    const resultado = await enviarWhatsApp(telefono, mensaje);

    if (resultado?.success) {
        return res.status(200).json({ message: "WhatsApp enviado con éxito" });
    } else {
        return res.status(500).json({ error: resultado?.message || 'Error desconocido en el envío de WhatsApp' });
    }
});

// ✅ Subir evidencia y guardar URL pública en Supabase
router.post('/:id/evidencia', upload.single('file'), async (req, res) => {
    const { id } = req.params;

    if (!req.file) return res.status(400).json({ error: 'No se proporcionó un archivo' });

    try {
        console.log("📌 [LOG] Subiendo evidencia...");

        const filePath = `evidencias_visitas/${id}_${Date.now()}${path.extname(req.file.originalname)}`;
        const { error: uploadError } = await supabase.storage
            .from('evidencias_visitas')
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) throw uploadError;

        const { publicUrl } = supabase.storage.from('evidencias_visitas').getPublicUrl(filePath);

        if (!publicUrl) {
            return res.status(500).json({ error: "No se pudo obtener la URL pública de la evidencia." });
        }

        console.log(`✅ [LOG] Evidencia subida correctamente: ${publicUrl}`);

        const { error: updateError } = await supabase
            .from('casos')
            .update({ evidencia_url: publicUrl })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ message: '✅ Evidencia subida y guardada correctamente', url: publicUrl });
    } catch (error) {
        console.error('❌ [LOG] Error al subir la evidencia:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/calendar-url', async (req, res) => {
    try {
        console.log("📅 [LOG] Obteniendo URL del calendario...");

        // Aquí se puede almacenar en Supabase o en una variable de entorno
        const calendarUrl = process.env.CALENDAR_URL || 
            "https://calendar.google.com/calendar/embed?src=cfe64a7e73e580180b6468e279686fb93434cf46a21de723b51dde3ef5a9bc96%40group.calendar.google.com&ctz=America%2FBogota";

        if (!calendarUrl) {
            return res.status(404).json({ error: "URL del calendario no configurada." });
        }

        res.status(200).json({ calendarUrl });
    } catch (error) {
        console.error("❌ [LOG] Error al obtener la URL del calendario:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


module.exports = router;
