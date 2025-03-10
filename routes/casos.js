const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { enviarCorreo } = require('../services/emailService'); // Solo una importación
const { v4: uuidv4 } = require('uuid');
const { enviarWhatsApp, enviarWhatsAppTemplate } = require('../services/whatsappService');
require('dotenv').config();

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
    "Ingreso": "https://forms.gle/GdWmReVymyzQLKGn6",
    "Seguimiento": "https://forms.gle/RMiHfRX1VUMCpYdQ7",
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
    { nombre: "Ana Isabel Aguirre", correo: "aaguirrer@atlas.com.co", telefono: "+573206779735"},
    { nombre: "Luisa Fernanda Tamayo", correo: "maria@empresa.com", telefono: "+573145104320"},
    { nombre: "Julieth Quilindo", correo: "carlos@empresa.com", telefono: "+573174011972"},
    { nombre: "Maritza Majin Rodríguez", correo: "maria@empresa.com", telefono: "+573172178473"},
    { nombre: "Jairo López ", correo: "carlos@empresa.com", telefono: "+573152354796 "},
    { nombre: "Henry Medina", correo: "maria@empresa.com", telefono: "+573005679960 "},
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
        observaciones = "", seContacto, analista, barrio = "", evaluador_telefono, recontactar
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
            ultima_interaccion: new Date().toISOString(), evidencia_url: "", barrio, evaluador_telefono
        };

        const { data, error } = await supabase.from('casos').insert([nuevoCaso]).select('*');
        if (error) throw error;
        const casoGuardado = data[0];

        if (!casoGuardado) {
            return res.status(500).json({ error: "No se pudo recuperar la solicitud después de la inserción." });
        }

        console.log("✅ Caso insertado en la BD:", casoGuardado);
        try {
            // Notificación al evaluado (seContacto === "Sí")
            if (seContacto === "Sí") {
                const templateName = "visita_domiciliaria_programada";
                const languageCode = "es_CO";
                const params = [
                    fecha_visita || "Por definir",    // {{1}} Fecha
                    hora_visita || "Por definir",       // {{2}} Hora
                    direccion || "No especificada",       // {{3}} Dirección
                    evaluador_asignado || "No asignado"   // {{4}} Evaluador
                ];
                if (email) {
                    await enviarCorreo(
                        email,
                        'Visita Domiciliaria Programada',
                        `Su visita domiciliaria está programada para el ${fecha_visita || "Por definir"} a las ${hora_visita || "Por definir"}.`
                    );
                }
                await enviarWhatsAppTemplate(telefono, templateName, languageCode, params);
            }

            // Notificación al evaluador (seContacto === "Sí")
            if (seContacto === "Sí") {
                const templateName = "asignacion_visita_evaluador";
                const languageCode = "es_CO";
                const params = [
                    solicitud,                           // {{1}} Solicitud
                    ciudad || "No especificada",         // {{2}} Ciudad
                    direccion || "No especificada",        // {{3}} Dirección
                    barrio || "",                        // {{4}} Barrio
                    punto_referencia || "No especificado",// {{5}} Punto de referencia
                    nombre,                              // {{6}} Evaluado
                    telefono,                            // {{7}} Teléfono
                    cliente,                             // {{8}} Empresa
                    cargo,                               // {{9}} Cargo
                    tipo_visita,                         // {{10}} Tipo de visita
                    linkFormulario                       // {{11}} Link del formulario
                ];
                await enviarCorreo(
                    evaluador_email,
                    'Actualización: Visita Asignada',
                    `Se le ha asignado la solicitud ${solicitud}.`
                );
                await enviarWhatsAppTemplate(casoGuardado.evaluador_telefono, templateName, languageCode, params);
            }

            // Notificación al analista (seContacto === "Sí" y existe analista)
            if (seContacto === "Sí" && analista) {
                const templateName = "asignacion_visita_analista";
                const languageCode = "es_CO";
                const params = [
                    solicitud,                           // {{1}} Solicitud
                    analista,                            // {{2}} Analista
                    nombre,                              // {{3}} Evaluado
                    cliente,                             // {{4}} Empresa
                    cargo,                               // {{5}} Cargo
                    ciudad || "No especificada",         // {{6}} Ciudad
                    fecha_visita || "Por definir",        // {{7}} Fecha
                    hora_visita || "Por definir"           // {{8}} Hora
                ];
                const analistaSeleccionado = analistas.find(a => a.nombre === analista);
                if (analistaSeleccionado) {
                    await enviarCorreo(
                        analistaSeleccionado.correo,
                        'Caso Asignado - Visita Programada',
                        `La solicitud ${solicitud} ha sido asignada.`
                    );
                    await enviarWhatsAppTemplate(analistaSeleccionado.telefono, templateName, languageCode, params);
                    // Enviar WhatsApp adicional a Henry Medina si es el analista asignado
                    if (analistaSeleccionado.nombre === "Henry Medina") {
                        await enviarWhatsAppTemplate(analistaSeleccionado.telefono, templateName, languageCode, params);
                    }
                }
            }

            // Notificación al evaluado (seContacto === "No")
            if (seContacto === "No") {
                const templateName = "intento_contacto_evaluado";
                const languageCode = "es_CO";
                const params = [
                    nombre,       // {{1}} Evaluado
                    cliente,      // {{2}} Empresa
                    cargo         // {{3}} Cargo
                ];
                await enviarCorreo(
                    email,
                    'Intento de Contacto - VerifiK',
                    `Se ha intentado contactar al evaluado ${nombre} sin éxito.`
                );
                await enviarWhatsAppTemplate(telefono, templateName, languageCode, params);
            }

            // Notificación al analista (seContacto === "No" y existe analista)
            if (seContacto === "No" && analista) {
                const templateName = "no_contacto_analista";
                const languageCode = "es_CO";
                const params = [
                    solicitud,             // {{1}} Solicitud
                    nombre,                // {{2}} Evaluado
                    cliente,               // {{3}} Empresa
                    cargo,                 // {{4}} Cargo
                    motivo_no_programacion,// {{5}} Motivo
                    intentos_contacto,     // {{6}} Número de intento
                    recontactar            // {{7}} ¿Se volverá a contactar?
                ];
                const analistaSeleccionado = analistas.find(a => a.nombre === analista);
                if (analistaSeleccionado) {
                    await enviarCorreo(
                        analistaSeleccionado.correo,
                        'No Contacto - VerifiK',
                        `No se ha logrado contactar al evaluado ${nombre} para la solicitud ${solicitud}.`
                    );
                    await enviarWhatsAppTemplate(analistaSeleccionado.telefono, templateName, languageCode, params);
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

    const estadosValidos = [
        "pendiente",
        "en curso",
        "programada",
        "standby",
        "terminada",
        "cancelada por evaluado",
        "cancelada por VerifiK",
        "cancelada por Atlas"
    ];
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

        // Mensaje textual (para correo o respaldo)
        const mensajeEstado = `🔔 ACTUALIZACION DE ESTADO\n\nLa solicitud ${caso.solicitud} ha sido actualizada al estado de ${estado}.\n\nEsto es un mensaje automático, este número no recibe mensajes. Si requiere comunicación, comuníquese con el WhatsApp: 3176520775 o el Email: verifikhm@gmail.com.`;

        // Datos para la plantilla aprobada "actualizacion_estado_caso"
        const templateName = "actualizacion_estado_caso";
        const languageCode = "es_CO";
        const params = [caso.solicitud, estado];

        try {
            // Notificar al analista, si se tiene correo y teléfono
            if (caso.analista_email) {
                await enviarCorreo(caso.analista_email, 'Actualización de Estado de Caso', mensajeEstado);
                await enviarWhatsAppTemplate(caso.analista_telefono, templateName, languageCode, params);
            }
            // Notificar al evaluador
            if (caso.evaluador_email) {
                await enviarCorreo(caso.evaluador_email, 'Actualización de Estado de Caso', mensajeEstado);
                await enviarWhatsAppTemplate(caso.evaluador_telefono, templateName, languageCode, params);
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