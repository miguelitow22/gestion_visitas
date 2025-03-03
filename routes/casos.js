const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { enviarCorreo } = require('../services/emailService');
const { enviarWhatsApp } = require('../services/whatsappService');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 📌 **Configuración de almacenamiento para evidencias**
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Máximo 5MB
});

// ✅ **Constantes con los correos y teléfonos de las regionales**
const regionales = {
    "Norte": { email: "regional.norte@empresa.com", telefono: "+573001112233" },
    "Sur": { email: "regional.sur@empresa.com", telefono: "+573002223344" },
    "Centro": { email: "regional.centro@empresa.com", telefono: "+573003334455" }
};

// ✅ **Formularios por tipo de visita**
const formularios = {
    "Ingreso": "https://formulario.com/ingreso",
    "Seguimiento": "https://formulario.com/seguimiento",
    "Ingreso Bicicletas HA": "https://formulario.com/bicicletas-ingreso",
    "Seguimiento Bicicletas HA": "https://formulario.com/bicicletas-seguimiento",
    "Atlas": "https://formulario.com/atlas",
    "Pic Colombia": "https://formulario.com/pic-colombia"
};

// ✅ **Validaciones de datos**
const validarEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validarTelefono = telefono => /^\+?\d{10,15}$/.test(telefono);

// ✅ **Crear un nuevo caso**
router.post('/', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "No se recibió un cuerpo en la solicitud." });
    }

    console.log("📌 Recibiendo datos en backend:", req.body);

    const {
        solicitud, nombre, documento, telefono, email, estado, tipo_visita, direccion,
        punto_referencia, fecha_visita, hora_visita, intentos_contacto = 0,
        motivo_no_programacion = "", evaluador_email, evaluador_asignado = "",
        contacto, cliente, cargo, regional, telefonoSecundario = "", telefonoTerciario = ""
    } = req.body;

    if (!solicitud || !nombre || !telefono || !email || !estado || !evaluador_email || !regional) {
        return res.status(400).json({ error: 'Datos obligatorios faltantes (incluyendo regional).' });
    }

    console.log("📌 Regional recibido en backend:", regional);

    // Validaciones
    if (!validarEmail(email) || !validarEmail(evaluador_email)) {
        return res.status(400).json({ error: 'Correo electrónico no válido' });
    }
    if (!validarTelefono(telefono)) {
        return res.status(400).json({ error: 'Número de teléfono no válido' });
    }

    try {
        // 📌 **Generar un ID único para el caso**
        const id = uuidv4();

        // 📌 **Obtener datos de la regional**
        const linkFormulario = formularios[tipo_visita] || "https://formulario.com/default";

        // 📌 **Guardar el caso en la base de datos**
        const nuevoCaso = {
            id,
            solicitud,
            nombre,
            documento,
            telefono,
            email,
            estado,
            tipo_visita,
            direccion,
            punto_referencia,
            fecha_visita,
            hora_visita,
            intentos_contacto,
            motivo_no_programacion,
            evaluador_email,
            evaluador_asignado,
            contacto,
            cliente,
            cargo,
            regional,
            telefonosecundario: telefonoSecundario,
            telefonoterciario: telefonoTerciario,
            ultima_interaccion: new Date().toISOString(),
            evidencia_url: ""
        };

        const { data, error } = await supabase.from('casos').insert([nuevoCaso]).select('*');

        if (error) throw error;
        const casoGuardado = data[0];

        if (!casoGuardado) {
            return res.status(500).json({ error: "No se pudo recuperar la solicitud después de la inserción." });
        }

        console.log("✅ Caso insertado en la BD:", casoGuardado);

        try {
            // ✅ Notificación al evaluado
            await enviarCorreo(email, 'Confirmación de Caso',
                `Estimado/a ${nombre}, su caso ha sido creado para ${fecha_visita} a las ${hora_visita}. 
                Por favor complete el siguiente formulario: ${linkFormulario}`
            );

            if (telefono) {
                await enviarWhatsApp(telefono,
                    `Su caso ha sido registrado para ${fecha_visita} a las ${hora_visita}. 
                    Complete el formulario aquí: ${linkFormulario}`
                );
            }
        } catch (err) {
            console.error("❌ Error en la notificación al evaluado:", err.message);
        }

        res.json({ message: '✅ Caso creado con éxito', data });

    } catch (error) {
        console.error('❌ Error al crear el caso:', error);
        res.status(500).json({ error: error.message });
    }
});


// ✅ **Actualizar estado de un caso**
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

        res.json({ message: 'Caso actualizado con éxito', data });

        
        const mensajeEstado = `🔔 El estado de su caso ha sido actualizado a: ${estado}`;
        
        try {
            // 📩 **Notificar al evaluado**
            await enviarCorreo(caso.email, 'Actualización de Caso', mensajeEstado);
            await enviarWhatsApp(caso.telefono, mensajeEstado);

            // 📩 **Notificar al evaluador si está asignado**
            if (caso.evaluador_email) {
                await enviarCorreo(caso.evaluador_email, 'Actualización de Caso', mensajeEstado);
            }

            // 📩 **Notificar a Atlas**
            await enviarCorreo('miguelopsal@gmail.com', 'Actualización de Caso', `${mensajeEstado} - Caso ${caso.solicitud}`);
            await enviarWhatsApp('+573146249096', `El estado del caso ${caso.solicitud} ha sido actualizado a: ${estado}`);
            
        } catch (notificacionError) {
            console.error("❌ Error en las notificaciones:", notificacionError.message);
        }

        res.json({ message: '✅ Caso actualizado con éxito', data });
        
        
    } catch (error) {
        console.error('❌ Error al actualizar el caso:', error);
        res.status(500).json({ error: error.message });
    }
});


// ✅ **Subir evidencia**
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


// ✅ Obtener un caso específico por ID
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