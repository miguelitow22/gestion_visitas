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
const regionales = ["Antioquia", "Caribe", "Centro", "Eje Cafetero", "Nororiente", "Occidente", "Oriente"];

// ✅ **Formularios por tipo de visita**
const formularios = {
    "Ingreso": "https://forms.gle/GdWmReVymyzQLKGn6  ",
    "Seguimiento": "https://forms.gle/RMiHfRX1VUMCpYdQ7  ",
    "Ingreso Bicicletas HA": "https://forms.gle/U54QxgtKBZX9u244A",
    "Seguimiento Bicicletas HA": "https://forms.gle/GTK6Jm6c5v5HkmKp9",
    "Atlas": "https://forms.gle/TNrQY9fhRpZWQFy56",
    "Pic Colombia": "https://forms.gle/rrkhzfu7muDGjgZt6",
    "Virtual": "https://forms.gle/8Z6n6g5sZ8Qv9L6m9prueba"
};


// ✅ **Validaciones de datos**
const validarEmail = email => email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : true;
const validarTelefono = telefono => /^\+?\d{10,15}$/.test(telefono);

// ✅ **Lista de analistas**
const analistas = [
    { nombre: "Ana Isabel Aguirre", correo: "carlos@empresa.com", telefono: "+573001234567" },
    { nombre: "Luisa Fernanda Tamayo", correo: "maria@empresa.com", telefono: "+573002345678" },
    { nombre: "Julieth Quilindo", correo: "carlos@empresa.com", telefono: "+573001234567" },
    { nombre: "Maritza Majin Rodríguez", correo: "maria@empresa.com", telefono: "+573002345678" },
    { nombre: "Jairo López ", correo: "carlos@empresa.com", telefono: "+573001234567" },
    { nombre: "Henry Medina", correo: "maria@empresa.com", telefono: "+573002345678" },
];

// ✅ **Crear un nuevo caso**
router.post('/', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "No se recibió un cuerpo en la solicitud." });
    }

    console.log("📌 Recibiendo datos en backend:", req.body);

    const {
        solicitud, nombre, documento, telefono, email = null, estado, tipo_visita, ciudad = "",
        direccion, punto_referencia, fecha_visita, hora_visita, intentos_contacto = 0,
        motivo_no_programacion = "", evaluador_email, evaluador_asignado = "",
        contacto, cliente, cargo, regional = "", telefonoSecundario = "", telefonoTerciario = "",
        observaciones = "", seContacto, analista,barrio = ""
    } = req.body;

    if (!solicitud || !nombre || !telefono || !estado) {
        return res.status(400).json({ error: 'Datos obligatorios faltantes.' });
    }

    if (seContacto === "Sí" && !evaluador_email) {
        return res.status(400).json({ error: 'El evaluador es obligatorio cuando se ha contactado al evaluado.' });
    }

    if (email && !validarEmail(email)) {
        return res.status(400).json({ error: 'Correo electrónico no válido' });
    }

    if (!validarTelefono(telefono)) {
        return res.status(400).json({ error: 'Número de teléfono no válido' });
    }

    try {
        // 📌 **Generar un ID único para el caso**
        const id = uuidv4();
        const linkFormulario = formularios[tipo_visita] || "https://formulario.com/default";

        // 📌 **Guardar el caso en la base de datos**
        const nuevoCaso = {
            id, solicitud, nombre, documento, telefono, email, estado,
            tipo_visita, ciudad, direccion, punto_referencia, fecha_visita,
            hora_visita, intentos_contacto, motivo_no_programacion,
            evaluador_email: seContacto === "Sí" ? evaluador_email : "",
            evaluador_asignado, contacto, cliente, cargo,
            regional: regional || "No aplica", telefonosecundario: telefonoSecundario,
            telefonoterciario: telefonoTerciario, observaciones,
            ultima_interaccion: new Date().toISOString(), evidencia_url: "",barrio
        };

        const { data, error } = await supabase.from('casos').insert([nuevoCaso]).select('*');

        if (error) throw error;
        const casoGuardado = data[0];

        if (!casoGuardado) {
            return res.status(500).json({ error: "No se pudo recuperar la solicitud después de la inserción." });
        }

        console.log("✅ Caso insertado en la BD:", casoGuardado);
        try {
            // Notificación al evaluado
            if (seContacto === "Sí") {
                const mensajeEvaluado = `✅ Su visita domiciliaria está programada para:\n📅 Fecha: ${fecha_visita || "Por definir"}\n🕐 Hora: ${hora_visita || "Por definir"}\n📍 Dirección: ${direccion || "No especificada"}\n👤 Evaluador: ${evaluador_asignado || "No asignado"}\n\n⚠️ *Si no puede atender la visita, debe cancelarla con tiempo comunicándose a:*\n📲 WhatsApp: [3176520775](https://wa.me/573176520775)\n📞 Celular: 3152354796  \n📞 Celular: 3023602245  \n📧 Email: verifikhm@gmail.com\n\n📝 *Recomendaciones para la visita:*  \n📌 Cuenta de servicios públicos  \n📌 Diplomas académicos  \n📌 Relación de gastos familiares  \n📌 Relación del historial laboral  \n\nℹ️ *Este es un mensaje automático, este número no recibe respuestas.*  \n*Si necesita comunicarse, use los datos indicados arriba.*`;

                if (email) {
                    await enviarCorreo(email, 'Visita Domiciliaria Programada', mensajeEvaluado);
                }

                await enviarWhatsApp(telefono, mensajeEvaluado);
            }

            // Notificación al evaluador

            if (seContacto === "Sí") {
                const mensajeEvaluador = `✅ Le fue asignada la solicitud: ${solicitud}\nDebe realizar dicha visita en:\n📍 Ciudad: ${ciudad || "No especificada"}\n🏠 Dirección: ${direccion || "No especificada"}\n📌 Barrio:${barrio}\n  Punto de referencia: ${punto_referencia || "No especificado"}\n👤 Evaluado: ${nombre}\n📞 Teléfono: ${telefono}\n🏢 Empresa: ${cliente}\n💼 Cargo: ${cargo}\n📝 Tipo de visita: ${tipo_visita}\n\n📋 Para realizar esta visita, diligencie el siguiente formulario:\n🔗 ${linkFormulario}\n\nℹ️ *Este es un mensaje automático, este número no recibe respuestas.*  \n*Si necesita comunicarse, use el WhatsApp: 3176520775 o el Email: verifikhm@gmail.com.*`;

                await enviarWhatsApp(evaluador_email, mensajeEvaluador);
            }
            //Notificacion analista
            if (seContacto === "Sí" && analista) {
                const mensajeAnalista = `✅ La solicitud: ${solicitud}, asignada por ${analista}, correspondiente a la visita del señor ${nombre} para la empresa ${cliente} para el cargo de ${cargo}, en la ciudad de ${ciudad}, está programada para el día ${fecha_visita} a las ${hora_visita}.\n\nℹ️ *Este es un mensaje automático, este número no recibe respuestas.*  \n*Si necesita comunicarse, use el WhatsApp: 3176520775 o el Email: verifikhm@gmail.com.*`;

                const analistaSeleccionado = analistas.find(a => a.nombre === analista);
                if (analistaSeleccionado) {
                    await enviarCorreo(analistaSeleccionado.correo, 'Caso Asignado - Visita Programada', mensajeAnalista);
                    await enviarWhatsApp(analistaSeleccionado.telefono, mensajeAnalista);
                }
            }
            // Enviar WhatsApp a Henry Medina
            if (analistaSeleccionado.nombre === "Henry Medina") {
                await enviarWhatsApp(analistaSeleccionado.telefono, mensajeAnalista);
            }
            // No contacto evaluado 
            if (seContacto === "No") {
                const mensajeEvaluado = `⚠️ Señor ${nombre}, nos estamos comunicando con usted de parte de *VerifiK*, proveedor de *Atlas Seguridad*, con el fin de programar una visita domiciliaria, solicitada por *${cliente}* dentro del proceso de selección para el cargo de *${cargo}*.\n\n❗ *La no comunicación oportuna con usted es razón para no realizar la visita y devolver el proceso a Atlas Seguridad.*\n\n📲 Por favor, comuníquese con nosotros a: \n📞 WhatsApp: [3176520775](https://wa.me/573176520775)\n📞 Celular: 3023602245\n✉️ Email: verifikhm@gmail.com\n\n*Este es un mensaje automático, este número no recibe mensajes. Si necesita comunicación, utilice los datos proporcionados.*`;

                await enviarCorreo(email, 'Intento de Contacto - VerifiK', mensajeEvaluado);
                await enviarWhatsApp(telefono, mensajeEvaluado);
            }

            if (seContacto === "No" && analista) {
                const mensajeAnalista = `⚠️ *ATENCIÓN: NO HA SIDO POSIBLE ESTABLECER CONTACTO*\n\n🔹 *Solicitud:* ${solicitud}\n🔹 *Evaluado:* ${nombre}\n🔹 *Empresa:* ${cliente}\n🔹 *Cargo:* ${cargo}\n🔹 *Motivo:* ${motivo_no_programacion}\n🔹 *Intento N°:* ${intentos_contacto}\n🔹 *¿Se volverá a contactar?:* ${recontactar}\n\n*Este es un mensaje automático, este número no recibe mensajes.* \n📞 WhatsApp: [3176520775](https://wa.me/573176520775)\n✉️ Email: verifikhm@gmail.com`;

                const analistaSeleccionado = analistas.find(a => a.nombre === analista);
                if (analistaSeleccionado) {
                    await enviarCorreo(analistaSeleccionado.correo, 'No Contacto - VerifiK', mensajeAnalista);
                    await enviarWhatsApp(analistaSeleccionado.telefono, mensajeAnalista);
                }
            }
        } catch (err) {
            console.error("❌ Error en las notificaciones:", err.message);
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
    let { estado, intentos_contacto, observaciones = "" } = req.body;

    const estadosValidos = ["pendiente", "en curso", "completado", "standby"];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "Estado no válido." });
    }

    try {
        const { data: caso } = await supabase.from('casos').select('*').eq('id', id).single();
        if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });

        const { data, error } = await supabase
            .from('casos')
            .update({ estado, intentos_contacto, observaciones, ultima_interaccion: new Date().toISOString() })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ message: '✅ Caso actualizado con éxito', data });

        const mensajeEstado = `🔔 El estado de su caso ha sido actualizado a: ${estado}`;

        try {
            // 📩 **Notificar al evaluador si está asignado**
            if (caso.analista_email) {
                await enviarCorreo(caso.analista_email, 'Actualización de Estado de Caso', mensajeEstado);
                await enviarWhatsApp(caso.analista_telefono, mensajeEstado);
            }
            // 📩 **Notificar al evaluador**
            if (caso.evaluador_email) {
                await enviarCorreo(caso.evaluador_email, 'Actualización de Estado de Caso', mensajeEstado);
                await enviarWhatsApp(caso.evaluador_telefono, mensajeEstado);
            }
        } catch (notificacionError) {
            console.error("❌ Error en las notificaciones:", notificacionError.message);
        }

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