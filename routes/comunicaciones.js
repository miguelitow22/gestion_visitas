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
        console.log("📌 [LOG] Obteniendo todas las comunicaciones...");
        const { data, error } = await supabase.from('comunicaciones').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ [LOG] Error al obtener las comunicaciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Registrar una nueva comunicación con validaciones mejoradas
router.post('/', async (req, res) => {
    const { caso_id, tipo, estado, comentario, intentos_contacto = 0, motivo_no_programacion = "" } = req.body;

    if (!caso_id || !tipo || !estado || !comentario) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        // Verificar si el caso existe antes de registrar la comunicación
        const { data: caso, error: casoError } = await supabase
            .from('casos')
            .select('id, email, telefono')
            .eq('id', caso_id)
            .maybeSingle();

        if (casoError) {
            console.error("❌ [LOG] Error al verificar el caso:", casoError);
            return res.status(500).json({ error: "Error al verificar el caso." });
        }

        if (!caso) {
            return res.status(404).json({ error: `El caso con ID ${caso_id} no existe.` });
        }

        // Insertar comunicación
        const { data, error } = await supabase
            .from('comunicaciones')
            .insert([{ caso_id, tipo, estado, comentario, intentos_contacto, motivo_no_programacion }])
            .select();

        if (error) throw error;

        // 📩 Notificar solo si hay email y teléfono
        const mensaje = `Nueva comunicación en su caso (${tipo}): ${comentario}`;
        await Promise.all([
            caso.email ? enviarCorreo(caso.email, 'Nueva Comunicación en su Caso', mensaje) : null,
            caso.telefono ? enviarWhatsApp(caso.telefono, mensaje) : null
        ]);

        res.status(201).json({ message: '✅ Comunicación registrada con éxito', data });

    } catch (error) {
        console.error('❌ [LOG] Error al registrar la comunicación:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Eliminar una comunicación solo si existe
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar si la comunicación existe antes de intentar eliminarla
        const { data: comunicacion, error: errorBuscar } = await supabase
            .from('comunicaciones')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (errorBuscar) {
            console.error("❌ [LOG] Error al buscar la comunicación:", errorBuscar);
            return res.status(500).json({ error: "Error al buscar la comunicación." });
        }

        if (!comunicacion) {
            return res.status(404).json({ error: "La comunicación no existe" });
        }

        // Eliminar comunicación
        const { error } = await supabase.from('comunicaciones').delete().eq('id', id);
        if (error) throw error;

        res.json({ message: '✅ Comunicación eliminada correctamente' });

    } catch (error) {
        console.error('❌ [LOG] Error al eliminar la comunicación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
