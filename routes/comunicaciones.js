const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { enviarCorreo } = require('../services/emailService');
const { enviarWhatsApp } = require('../services/whatsappService');
require('dotenv').config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Obtener todas las comunicaciones
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from('comunicaciones').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ Error al obtener las comunicaciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener historial de comunicaciones de un caso específico
router.get('/:caso_id', async (req, res) => {
    const { caso_id } = req.params;
    try {
        const { data, error } = await supabase.from('comunicaciones').select('*').eq('caso_id', caso_id);
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ Error al obtener comunicaciones del caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Registrar una nueva comunicación y enviar notificaciones
router.post('/', async (req, res) => {
    const { caso_id, tipo, estado, comentario } = req.body;

    if (!caso_id || !tipo || !estado || !comentario) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const { data, error } = await supabase
            .from('comunicaciones')
            .insert([{ caso_id, tipo, estado, comentario }])
            .select();

        if (error) throw error;

        // 📩 Obtener datos del caso para enviar notificaciones
        const { data: caso } = await supabase.from('casos').select('*').eq('id', caso_id).single();

        if (caso) {
            const mensaje = `Nueva comunicación registrada en su caso (${tipo}): ${comentario}`;

            // 📩 Notificar al evaluado
            await enviarCorreo(caso.email, 'Nueva Comunicación en su Caso', mensaje);
            await enviarWhatsApp(caso.telefono, mensaje);

            // 📩 Notificar al evaluador
            await enviarCorreo(caso.evaluador_email, 'Nueva Comunicación en Caso Asignado', mensaje);
            await enviarWhatsApp(caso.evaluador_email, mensaje);

            // 📩 Notificar a Atlas
            await enviarCorreo('atlas@empresa.com', 'Nueva Comunicación Registrada', mensaje);
            await enviarWhatsApp('atlas@empresa.com', mensaje);
        }

        res.status(201).json({ message: 'Comunicación registrada y notificaciones enviadas', data });
    } catch (error) {
        console.error('❌ Error al registrar la comunicación:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Eliminar una comunicación
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('comunicaciones').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Comunicación eliminada correctamente' });
    } catch (error) {
        console.error('❌ Error al eliminar la comunicación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
