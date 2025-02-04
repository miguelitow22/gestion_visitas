const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../supabaseClient');
const { enviarCorreo } = require('./emailService');
const { enviarMensajeWhatsApp } = require('./whatsappService');

const upload = multer({ storage: multer.memoryStorage() });

// ✅ Obtener todos los casos
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from("casos").select("*");
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ✅ Crear un nuevo caso con ID personalizado
router.post('/', async (req, res) => {
    const { id, nombre, telefono, email, estado, intentos_contacto, evaluador_email } = req.body;

    if (!id || !nombre || !telefono || !email || !estado) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    try {
        const { data, error } = await supabase.from("casos").insert([
            { id, nombre, telefono, email, estado, intentos_contacto, evaluador_email }
        ]);

        if (error) throw error;

        // ✅ Enviar notificación por correo y WhatsApp
        await enviarCorreo(email, "Nuevo Caso Asignado", `Hola ${nombre}, tu caso ha sido registrado.`);
        await enviarMensajeWhatsApp(telefono, `Hola ${nombre}, tu caso ha sido registrado.`);

        res.json({ message: "Caso creado exitosamente", data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Actualizar estado e intentos de contacto con notificación
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { estado, intentos_contacto } = req.body;

    try {
        const { data, error } = await supabase.from("casos")
            .update({ estado, intentos_contacto, ultima_interaccion: new Date() })
            .eq("id", id);

        if (error) throw error;

        // ✅ Obtener datos del caso para notificación
        const { data: caso } = await supabase.from("casos").select("nombre, email, telefono").eq("id", id).single();
        
        if (caso) {
            await enviarCorreo(caso.email, "Actualización de Caso", `Hola ${caso.nombre}, el estado de tu caso ha cambiado a ${estado}.`);
            await enviarMensajeWhatsApp(caso.telefono, `Hola ${caso.nombre}, tu caso ahora está en estado: ${estado}.`);
        }

        res.json({ message: "Caso actualizado correctamente", data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Subir evidencia con validación en Supabase
router.post('/:id/evidencia', upload.single("archivo"), async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: "No se ha subido ningún archivo." });
    }

    try {
        const filePath = `casos/${id}/${req.file.originalname}`;

        const { error: bucketError } = await supabase.storage.getBucket('evidencias_visitas');
        if (bucketError) {
            return res.status(404).json({ error: "Bucket 'evidencias_visitas' no encontrado en Supabase." });
        }

        const { data, error } = await supabase.storage
            .from('evidencias_visitas')
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

        if (error) throw error;

        const publicURL = `https://YOUR_SUPABASE_URL/storage/v1/object/public/evidencias_visitas/${filePath}`;

        await supabase
            .from("casos")
            .update({ evidencia_url: publicURL })
            .eq("id", id);

        res.json({ message: "Evidencia subida con éxito", url: publicURL });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
