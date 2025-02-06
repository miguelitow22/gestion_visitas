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

// ✅ Funciones de validación
const validarEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validarTelefono = telefono => /^\+?\d{10,15}$/.test(telefono);

// ✅ Crear un nuevo caso con ID único y validaciones
router.post('/', async (req, res) => {
    const {
        id, nombre, documento, telefono, email, estado, tipo_visita, direccion,
        punto_referencia, fecha_visita, hora_visita, intentos_contacto = 0,
        motivo_no_programacion = "", evaluador_email, evaluador_asignado = "",
        solicitud = "", contacto = "", cliente = "", cargo = "", regional = "",
        telefonoSecundario = "", telefonoTerciario = ""
    } = req.body;

    if (!id || !nombre || !telefono || !email || !estado || !evaluador_email) {
        return res.status(400).json({ error: 'ID, nombre, teléfono, email, estado y evaluador_email son obligatorios' });
    }
    console.log("📧 Validando email:", email);
    console.log("📧 Validando evaluador_email:", evaluador_email);


    if (!validarEmail(email) || !validarEmail(evaluador_email)) {
        return res.status(400).json({ error: 'Correo electrónico no válido' });
    }

    if (!validarTelefono(telefono)) {
        return res.status(400).json({ error: 'Número de teléfono no válido' });
    }

    try {
        // Verificar si el ID ya existe
        const { data: casoExistente } = await supabase
            .from('casos')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (casoExistente) {
            return res.status(400).json({ error: '❌ El ID del caso ya existe. Prueba con otro ID.' });
        }

        const { data, error } = await supabase
            .from('casos')
            .insert([{
                id, nombre, documento, telefono, email, estado, tipo_visita, direccion,
                punto_referencia, fecha_visita, hora_visita, intentos_contacto,
                evaluador_email, evaluador_asignado, solicitud, contacto,
                cliente, cargo, regional,
                telefonosecundario: telefonoSecundario, // ✅ Corregido
                telefonoterciario: telefonoTerciario, // ✅ Corregido
                ultima_interaccion: new Date().toISOString(), evidencia_url: ""
            }])
            .select();


        if (error) throw error;

        // 📩 Notificaciones
        const mensajeEvaluado = `Estimado/a ${nombre}, su caso ha sido creado con fecha : ${fecha_visita} y hora:  ${hora_visita}.`;
        await Promise.all([
            enviarCorreo(email, 'Confirmación de Caso', mensajeEvaluado),
            enviarWhatsApp(telefono, mensajeEvaluado),
            enviarCorreo(evaluador_email, 'Nuevo Caso Asignado', `Se le ha asignado un nuevo caso con ID: ${id} en la fecha: ${fecha_visita}y hora: ${hora_visita} en  la direccion ${direccion}`),
            enviarCorreo('atlas@empresa.com', 'Nuevo Caso Creado', `Nuevo caso creado con ID: ${id}, nombre del evaluado ${nombre}.`)
        ]);

        res.json({ message: '✅ Caso creado con éxito', data });

    } catch (error) {
        console.error('❌ Error al crear el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Actualizar estado de un caso
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    let { estado, intentos_contacto } = req.body;

    const estadosValidos = ["pendiente", "en curso", "completado", "standby"];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "Estado no válido." });
    }

    try {
        const { data: caso } = await supabase.from('casos').select('*').eq('id', id).single();
        if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });

        const { data, error } = await supabase
            .from('casos')
            .update({ estado, intentos_contacto, ultima_interaccion: new Date().toISOString() })
            .eq('id', id)
            .select();

        if (error) throw error;

        // 📩 Notificaciones
        const mensajeEstado = `El estado del caso ${id} ha sido actualizado a: ${estado}`;
        await Promise.all([
            enviarCorreo(caso.email, 'Actualización de Caso', mensajeEstado),
            enviarWhatsApp(caso.telefono, mensajeEstado),
            enviarCorreo(caso.evaluador_email, 'Actualización de Caso', mensajeEstado),
            enviarCorreo('atlas@empresa.com', 'Actualización de Caso', mensajeEstado)
        ]);

        res.json({ message: 'Caso actualizado con éxito', data });

    } catch (error) {
        console.error('❌ Error al actualizar el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Subir evidencia
router.post('/:id/evidencia', upload.single("archivo"), async (req, res) => {
    const { id } = req.params;
    
    if (!req.file) {
        return res.status(400).json({ error: "No se ha subido ningún archivo." });
    }

    try {
        console.log("📌 [LOG] Subiendo evidencia para el caso:", id);
        console.log("📁 [LOG] Nombre del archivo:", req.file.originalname);
        console.log("📁 [LOG] Tipo de archivo:", req.file.mimetype);
        console.log("📁 [LOG] Tamaño del archivo:", req.file.size, "bytes");

        const filePath = `casos/${id}/${Date.now()}_${req.file.originalname}`;
        
        const { data, error: uploadError } = await supabase.storage
            .from('evidencias_visitas') 
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) {
            console.error("❌ [LOG] Error en la subida del archivo:", uploadError);
            return res.status(500).json({ error: "Error al subir el archivo a Supabase.", details: uploadError });
        }

        console.log("✅ [LOG] Archivo subido exitosamente en Supabase.");

        // ✅ Intentar obtener la URL pública
        let { publicUrl } = supabase.storage.from('evidencias_visitas').getPublicUrl(filePath);

        if (!publicUrl || publicUrl.includes('undefined')) {
            console.warn("⚠️ [LOG] No se pudo obtener la URL pública, generando Signed URL...");

            // 🚀 Si el bucket es privado, usar Signed URL
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('evidencias_visitas')
                .createSignedUrl(filePath, 60 * 60 * 24); // URL válida por 24 horas

            if (signedUrlError) {
                console.error("❌ [LOG] Error al generar Signed URL:", signedUrlError);
                return res.status(500).json({ error: "No se pudo generar la URL pública ni la Signed URL." });
            }

            publicUrl = signedUrlData.signedUrl;
        }

        // ✅ Guardar la URL en la base de datos
        const { error: updateError } = await supabase
            .from('casos')
            .update({ evidencia_url: publicUrl })
            .eq('id', id);

        if (updateError) {
            console.error("❌ [LOG] Error al actualizar la evidencia en la base de datos:", updateError);
            return res.status(500).json({ error: "Error al guardar la evidencia en la base de datos." });
        }

        console.log(`✅ [LOG] Evidencia subida correctamente: ${publicUrl}`);
        res.json({ message: "✅ Evidencia subida con éxito", url: publicUrl });

    } catch (error) {
        console.error('❌ [LOG] Error al subir la evidencia:', error);
        res.status(500).json({ error: error.message });
    }
});


// ✅ Obtener un caso por ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from('casos').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Caso no encontrado." });
        res.json(data);
    } catch (error) {
        console.error('❌ Error al obtener el caso:', error);
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

module.exports = router;
