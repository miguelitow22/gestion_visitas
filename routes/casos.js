const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { enviarCorreo } = require('../services/emailService');
const { enviarWhatsApp } = require('../services/whatsappService');
require('dotenv').config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
});

// ✅ Crear un nuevo caso y notificar a todos
router.post('/', async (req, res) => {
    const { nombre, telefono, email, estado, intentos_contacto, evaluador_email } = req.body;

    if (!nombre || !telefono || !email || !estado || !evaluador_email) {
        return res.status(400).json({ error: 'Nombre, teléfono, email, estado y evaluador_email son obligatorios' });
    }

    try {
        const { data, error } = await supabase
            .from('casos')
            .insert([{ nombre, telefono, email, estado, intentos_contacto: intentos_contacto || 0, evaluador_email }])
            .select();

        if (error) throw error;

        // 📩 Notificar al evaluado
        const mensajeEvaluado = `Estimado/a ${nombre}, su caso ha sido creado con estado: ${estado}. Le informaremos sobre cualquier actualización.`;
        await enviarCorreo(email, 'Confirmación de Caso', mensajeEvaluado);
        await enviarWhatsApp(telefono, mensajeEvaluado);

        // 📩 Notificar al evaluador
        const mensajeEvaluador = `Se le ha asignado un nuevo caso para evaluación: ${nombre}. Contacto: ${telefono}.`;
        await enviarCorreo(evaluador_email, 'Nuevo Caso Asignado', mensajeEvaluador);
        await enviarWhatsApp(telefono, mensajeEvaluador);

        // 📩 Notificar a Atlas
        const mensajeAtlas = `Se ha asignado un nuevo caso: ${nombre}, asignado a ${evaluador_email}.`;
        await enviarCorreo('atlas@empresa.com', 'Nuevo Caso Creado', mensajeAtlas);
        await enviarWhatsApp('atlas@empresa.com', mensajeAtlas);

        res.json({ message: 'Caso creado y notificaciones enviadas correctamente', data });
    } catch (error) {
        console.error('❌ Error al crear el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener todos los casos
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from('casos').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ Error al obtener los casos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener un caso por ID
router.get('/:caso_id', async (req, res) => {
    const { caso_id } = req.params;
    try {
        const { data, error } = await supabase.from('casos').select('*').eq('id', caso_id).single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ Error al obtener el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Actualizar estado de un caso y notificar a todos
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    let { estado, intentos_contacto } = req.body;

    if (!['pendiente', 'en curso', 'completado', 'standby'].includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
    }

    try {
        const { data: caso } = await supabase.from('casos').select('*').eq('id', id).single();

        if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });

        if (caso.intentos_contacto >= 3 && caso.estado !== 'standby') {
            estado = 'standby';
        }

        const { data, error } = await supabase
            .from('casos')
            .update({ estado, intentos_contacto, ultima_interaccion: new Date().toISOString() })
            .eq('id', id)
            .select();

        if (error) throw error;

        // 📩 Notificar al evaluado, evaluador y Atlas sobre el cambio de estado
        const mensajeEstado = `El estado del caso ${id} ha sido actualizado a: ${estado}`;
        await enviarCorreo(caso.email, 'Actualización de Caso', mensajeEstado);
        await enviarWhatsApp(caso.telefono, mensajeEstado);
        await enviarCorreo(caso.evaluador_email, 'Actualización de Caso', mensajeEstado);
        await enviarWhatsApp(caso.evaluador_email, mensajeEstado);
        await enviarCorreo('atlas@empresa.com', 'Actualización de Caso', mensajeEstado);
        await enviarWhatsApp('atlas@empresa.com', mensajeEstado);

        res.json({ message: 'Caso actualizado y notificaciones enviadas correctamente', data });
    } catch (error) {
        console.error('❌ Error al actualizar el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
