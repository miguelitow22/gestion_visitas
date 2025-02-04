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

// ✅ Crear un nuevo caso con ID personalizado y notificación
router.post('/', async (req, res) => {
    const { id, nombre, telefono, email, estado, intentos_contacto, evaluador_email } = req.body;

    if (!id || !nombre || !telefono || !email || !estado || !evaluador_email) {
        return res.status(400).json({ error: 'ID, nombre, teléfono, email, estado y evaluador_email son obligatorios' });
    }

    try {
        // Verificar si el caso ya existe
        const { data: casoExistente } = await supabase.from('casos').select('*').eq('id', id).single();
        if (casoExistente) {
            return res.status(400).json({ error: 'El ID del caso ya existe' });
        }

        // Insertar nuevo caso en la base de datos
        const { data, error } = await supabase
            .from('casos')
            .insert([{ id, nombre, telefono, email, estado, intentos_contacto: intentos_contacto || 0, evaluador_email, ultima_interaccion: new Date().toISOString() }])
            .select();

        if (error) throw error;

        // 📩 Notificar al evaluado
        const mensajeEvaluado = `Estimado/a ${nombre}, su caso ha sido creado con ID: ${id} y estado: ${estado}.`;
        await enviarCorreo(email, 'Confirmación de Caso', mensajeEvaluado);
        await enviarWhatsApp(telefono, mensajeEvaluado);

        // 📩 Notificar al evaluador y a Atlas
        const mensajeEvaluador = `Se le ha asignado un nuevo caso con ID: ${id}.`;
        await enviarCorreo(evaluador_email, 'Nuevo Caso Asignado', mensajeEvaluador);
        await enviarCorreo('atlas@empresa.com', 'Nuevo Caso Creado', mensajeEvaluador);

        res.json({ message: 'Caso creado con ID personalizado y notificaciones enviadas', data });
    } catch (error) {
        console.error('❌ Error al crear el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Actualizar estado de un caso y notificar
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    let { estado, intentos_contacto } = req.body;

    if (!['pendiente', 'en curso', 'completado', 'standby'].includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
    }

    try {
        const { data: caso } = await supabase.from('casos').select('*').eq('id', id).single();
        if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });

        // Actualizar estado e intentos de contacto
        const { data, error } = await supabase
            .from('casos')
            .update({ estado, intentos_contacto, ultima_interaccion: new Date().toISOString() })
            .eq('id', id)
            .select();

        if (error) throw error;

        // 📩 Notificar sobre la actualización de estado
        const mensajeEstado = `El estado del caso ${id} ha sido actualizado a: ${estado}`;
        await enviarCorreo(caso.email, 'Actualización de Caso', mensajeEstado);
        await enviarWhatsApp(caso.telefono, mensajeEstado);
        await enviarCorreo(caso.evaluador_email, 'Actualización de Caso', mensajeEstado);
        await enviarCorreo('atlas@empresa.com', 'Actualización de Caso', mensajeEstado);

        res.json({ message: 'Caso actualizado y notificaciones enviadas correctamente', data });
    } catch (error) {
        console.error('❌ Error al actualizar el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Subir evidencia para un caso con verificación del bucket
router.post('/:id/evidencia', upload.single("archivo"), async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: "No se ha subido ningún archivo." });
    }

    try {
        const filePath = `casos/${id}/${req.file.originalname}`;

        // Verificar si el bucket existe antes de subir
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('evidencias_visitas');
        if (bucketError || !bucketData) {
            return res.status(404).json({ error: "Bucket 'evidencias_visitas' no encontrado en Supabase." });
        }

        // Subir archivo al bucket de evidencias
        const { data, error } = await supabase.storage
            .from('evidencias_visitas')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (error) throw error;

        // Actualizar la base de datos con la URL del archivo
        await supabase
            .from("casos")
            .update({ evidencia_url: filePath })
            .eq("id", id);

        res.json({ message: "Evidencia subida con éxito", url: filePath });
    } catch (error) {
        console.error("❌ Error al subir evidencia:", error);
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
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from('casos').select('*').eq('id', id).single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ Error al obtener el caso:', error);
        res.status(500).json({ error: error.message });
    }
});
    
module.exports = router;
