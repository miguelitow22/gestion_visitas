const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { enviarCorreo } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');
const { enviarWhatsApp, enviarWhatsAppTemplate } = require('../services/whatsappService');
require('dotenv').config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// -------------------------------------------------------------
// Configuración de almacenamiento para evidencias con Multer
// -------------------------------------------------------------
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Máximo 5MB
});

// -------------------------------------------------------------
// Constantes globales
// -------------------------------------------------------------
const regionales = ["Antioquia", "Caribe", "Centro", "Eje Cafetero", "Nororiente", "Occidente", "Oriente"];

const formularios = {
    "Ingreso": "https://forms.gle/GdWmReVymyzQLKGn6",
    "Seguimiento": "https://forms.gle/RMiHfRX1VUMCpYdQ7",
    "Ingreso Bicicletas HA": "https://forms.gle/U54QxgtKBZX9u244A",
    "Seguimiento Bicicletas HA": "https://forms.gle/GTK6Jm6c5v5HkmKp9",
    "Atlas": "https://forms.gle/TNrQY9fhRpZWQFy56",
    "Pic Colombia": "https://forms.gle/rrkhzfu7muDGjgZt6",
    "Virtual": "https://forms.gle/8Z6n6g5sZ8Qv9L6m9prueba"
};

/**
 * Función para obtener el link del formulario según el tipo de visita.
 * Se trabaja con el valor en minúsculas y se realiza búsqueda parcial.
 */
function obtenerLinkFormulario(tipo_visita) {
  const key = tipo_visita.toLowerCase().trim();
  if (key.includes("bicicleta") && key.includes("ingreso")) {
    return formularios["Ingreso Bicicletas HA"];
  }
  if (key.includes("bicicleta") && key.includes("seguimiento")) {
    return formularios["Seguimiento Bicicletas HA"];
  }
  if (key.includes("ingreso")) {
    return formularios["Ingreso"];
  }
  if (key.includes("seguimiento")) {
    return formularios["Seguimiento"];
  }
  if (key.includes("atlas")) {
    return formularios["Atlas"];
  }
  if (key.includes("pic")) {
    return formularios["Pic Colombia"];
  }
  if (key.includes("virtual")) {
    return formularios["Virtual"];
  }
  return "https://formulario.com/default";
}

// -------------------------------------------------------------
// Validaciones de datos
// -------------------------------------------------------------
const validarEmail = email => email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : true;
const validarTelefono = telefono => /^\+?\d{10,15}$/.test(telefono);

// -------------------------------------------------------------
// Lista de analistas
// -------------------------------------------------------------
const analistas = [
    { nombre: "Ana Isabel Aguirre", correo: "aaguirrer@atlas.com.co", telefono: "+573206779735" },
    { nombre: "Luisa Fernanda Tamayo", correo: "lftamayo@atlas.com.co", telefono: "+573145104320" },
    { nombre: "Julieth Quilindo", correo: "jquilindo@atlas.com.co", telefono: "+573174011972" },
    { nombre: "Maritza Majin Rodríguez", correo: "secinvescali3@atlas.com.co", telefono: "+573172178473" },
    { nombre: "Henry Medina", correo: "henrymedina8@gmail.com", telefono: "+573005679960" },
];

// -------------------------------------------------------------
// Endpoint: Crear un nuevo caso
// -------------------------------------------------------------
router.post('/', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "No se recibió un cuerpo en la solicitud." });
    }

    console.log("📌 Recibiendo datos en backend:", req.body);

    // Desestructurar los campos, incluyendo los del analista
    const {
        solicitud,
        nombre,
        documento,
        telefono,
        email = null,
        estado,
        tipo_visita,
        ciudad = "",
        direccion,
        punto_referencia,
        fecha_visita,
        hora_visita,
        intentos_contacto = 0,
        motivo_no_programacion = "",
        evaluador_email,
        evaluador_asignado = "",
        contacto,
        cliente,
        cargo,
        regional = "",
        telefonoSecundario = "",
        telefonoTerciario = "",
        observaciones = "",
        seContacto,
        // Campos vinculados al analista
        analista_asignado,             // Nombre del analista seleccionado
        analista_email = "",  // Correo del analista
        analista_telefono = "", // Teléfono del analista
        barrio = "",
        evaluador_telefono,
        recontactar,
        programador = "",
        gastos_adicionales = 0
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

    // Cálculo de viáticos basado en la ciudad
    const municipiosViaticos = {
        "Medellín": 0,
        "Medellín (Belén AltaVista parte alta)": 15000,
        "Medellín (San Antonio de Prado)": 16000,
        "Medellín (San Cristóbal)": 10000,
        "Medellín (Santa Elena)": 49000,
        "Barbosa": 39000,
        "Bello": 0,
        "Bello (Vereda Hato Viejo)": 34000,
        "Caldas": 20000,
        "Copacabana": 16000,
        "Envigado": 0,
        "Girardota": 16000,
        "Itagüí": 0,
        "La Estrella": 16000,
        "Sabaneta": 0,
        "Amaga": 44000,
        "Angelópolis": 44000,
        "Arboletes": 294000,
        "Carepa": 224000,
        "Caucasia": 164000,
        "Chigorodó": 214000,
        "Cisneros": 84000,
        "Don Matías": 84000,
        "El Carmen de Viboral": 54000,
        "El peñol": 74000,
        "Entrerríos": 84000,
        "Guarne": 34000,
        "Jardín": 150000,
        "La ceja": 38000,
        "Marinilla": 68000,
        "Puerto Berrio": 124000,
        "Rionegro": 44000,
        "Salgar": 114000,
        "San Andrés de Cuerquia": 124000,
        "San Jerónimo": 46000,
        "San Pedro de los Milagros": 38000,
        "San Vicente Ferrer": 44000,
        "Santa Fe de Antioquia": 50000,
        "Santa Rosa de Osos": 102000,
        "Santo Domingo": 104000,
        "Santuario": 108000,
        "Segovia": 173000,
        "Taraza": 194000,
        "Turbo": 244000,
        "Yarumal": 120000,
    };
      
    const viaticosValor = municipiosViaticos[ciudad] || 0;
      
    try {
        // Generar un ID único para el caso
        const id = uuidv4();
        // Obtener el link del formulario según el tipo de visita
        const linkFormulario = obtenerLinkFormulario(tipo_visita);

        // Construir el objeto a insertar en la base de datos
        const nuevoCaso = {
            id,
            solicitud,
            nombre,
            documento,
            telefono,
            email,
            estado,
            tipo_visita,
            ciudad,
            direccion,
            punto_referencia,
            fecha_visita,
            hora_visita,
            intentos_contacto,
            motivo_no_programacion,
            evaluador_email: seContacto === "Sí" ? evaluador_email : "",
            evaluador_asignado,
            contacto,
            cliente,
            cargo,
            regional: regional || "No aplica",
            telefonosecundario: telefonoSecundario,
            telefonoterciario: telefonoTerciario,
            observaciones,
            ultima_interaccion: new Date().toISOString(),
            evidencia_url: "",
            barrio,
            evaluador_telefono,
            viaticos: viaticosValor,
            gastos_adicionales: gastos_adicionales,
            programador,
            // Campos para el analista
            analista_asignado: analista_asignado || "",
            analista_email: analista_email || "",
            analista_telefono: analista_telefono || ""
        };

        const { data, error } = await supabase.from('casos').insert([nuevoCaso]).select('*');
        if (error) throw error;
        const casoGuardado = data[0];

        if (!casoGuardado) {
            return res.status(500).json({ error: "No se pudo recuperar la solicitud después de la inserción." });
        }

        // Enviar notificaciones
        // Notificación al evaluado (cuando se contactó)
        if (seContacto === "Sí") {
            const templateName = "visita_domiciliaria_programada";
            const languageCode = "es_CO";
            const params = [
                fecha_visita || "Por definir",
                hora_visita || "Por definir",
                direccion || "No especificada",
                evaluador_asignado || "No asignado"
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

        // Notificación al evaluador (cuando se contactó)
        if (seContacto === "Sí") {
            const templateName = "asignacion_visita_de_evaluador";
            const languageCode = "es_CO";
            const params = [
                solicitud,
                fecha_visita || "Por definir",
                hora_visita || "Por definir",
                ciudad || "No especificada",
                direccion || "No especificada",
                barrio || "",
                punto_referencia || "No especificado",
                nombre,
                telefono,
                cliente,
                cargo,
                tipo_visita,
                linkFormulario
            ];
            await enviarCorreo(
                evaluador_email,
                'Actualización: Visita Asignada',
                `Se le ha asignado la solicitud ${solicitud}.`
            );
            await enviarWhatsAppTemplate(casoGuardado.evaluador_telefono, templateName, languageCode, params);
        }

        // Depurar y mostrar en consola los datos del analista
        console.log("Datos del analista:", { analista_asignado, analista_email, analista_telefono });

        // Notificación al analista (si se seleccionó)
        if (analista_asignado && analista_email && analista_telefono) {
            const templateName = "asignacion_visita_analista";
            const languageCode = "es_CO";
            const params = [
                solicitud,
                analista_asignado,
                nombre,
                cliente,
                cargo,
                ciudad || "No especificada",
                fecha_visita || "Por definir",
                hora_visita || "Por definir"
            ];
            try {
                await enviarCorreo(
                    analista_email,
                    'Caso Asignado - Visita Programada',
                    `La solicitud ${solicitud} ha sido asignada a ti.`
                );
                await enviarWhatsAppTemplate(analista_telefono, templateName, languageCode, params);
            } catch (err) {
                console.error("❌ Error enviando notificación al analista:", err.message);
            }
        }

        // Notificaciones cuando no se contactó al evaluado
        if (seContacto === "No") {
            const templateName = "intento_contacto_evaluado";
            const languageCode = "es_CO";
            const params = [
                nombre,
                cliente,
                cargo
            ];
            await enviarCorreo(
                email,
                'Intento de Contacto - VerifiK',
                `Se ha intentado contactar al evaluado ${nombre} sin éxito.`
            );
            await enviarWhatsAppTemplate(telefono, templateName, languageCode, params);
        }

        console.log("✅ Caso insertado en la BD:", casoGuardado);
        res.json({ message: '✅ Caso creado con éxito', data });
    } catch (error) {
        console.error('❌ Error al crear el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// Endpoint: Actualizar estado de un caso
// -------------------------------------------------------------
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    let { estado, intentos_contacto, observaciones = "", fecha_visita, hora_visita } = req.body;

    const estadosValidos = [
        "pendiente",
        "en curso",
        "programada",
        "standby",
        "terminada",
        "cancelada por evaluado",
        "cancelada por VerifiK",
        "cancelada por Atlas",
        "subida al Drive",
        "reprogramada"
    ];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "Estado no válido." });
    }

    try {
        const { data: caso } = await supabase.from('casos').select('*').eq('id', id).single();
        if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });

        const { data, error } = await supabase
            .from('casos')
            .update({ 
                estado, 
                intentos_contacto, 
                observaciones, 
                fecha_visita, 
                hora_visita, 
                ultima_interaccion: new Date().toISOString() 
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ message: '✅ Caso actualizado con éxito', data });

        // Mensaje textual para respaldo o correo
        const mensajeEstado = `🔔 ACTUALIZACION DE ESTADO\n\nLa solicitud ${caso.solicitud} ha sido actualizada al estado de ${estado}.\n\nEsto es un mensaje automático, este número no recibe mensajes. Si requiere comunicación, comuníquese con el WhatsApp: 3176520775 o el Email: verifikhm@gmail.com.`;

        const templateName = "actualizacion_estado_caso";
        const languageCode = "es_CO";
        const params = [caso.solicitud, estado];

        try {
            // Notificar al programador si el estado es "subida al Drive"
            if (estado === "subida al Drive") {
                const templateName = "actualizacion_subida_drive";
                const languageCode = "es_CO";
                const programadorTelefono = "+573176520775";
                const programadorEmail = "verifikhm@gmail.com";

                const mensajeCorreo = `
                🔔 ACTUALIZACIÓN DE ESTADO
                La solicitud ${caso.solicitud} ha sido subida al Drive para ser revisada y complementada.
                Una vez complementada, súbala al sistema Savila de Atlas Seguridad y asegúrese de cambiar el estado a TERMINADA.
                Este es un mensaje automático, no responda directamente.
                Si necesita ayuda, comuníquese al WhatsApp: ${programadorTelefono} o al Email: ${programadorEmail}.
                `;

                try {
                    await enviarCorreo(
                        programadorEmail,
                        `Caso ${caso.solicitud} subida al Drive`,
                        mensajeCorreo
                    );
                    await enviarWhatsAppTemplate(
                        programadorTelefono,
                        templateName,
                        languageCode,
                        [caso.solicitud]
                    );
                    console.log("✅ Notificaciones enviadas correctamente al programador.");
                } catch (errorNotificacion) {
                    console.error('❌ Error enviando notificaciones:', errorNotificacion);
                }
            }

            // Notificar al evaluador si el estado es "reprogramada"
            const updatedCase = data[0];
            if (estado === "reprogramada") {
                const linkFormulario = obtenerLinkFormulario(updatedCase.tipo_visita);
                const templateName = "reprogramacion_visita_evaluador1";
                const languageCode = "es_CO";
                const params = [
                    updatedCase.solicitud,
                    updatedCase.fecha_visita || "Por definir",
                    updatedCase.hora_visita || "Por definir",
                    updatedCase.ciudad || "No especificada",
                    updatedCase.direccion || "No especificada",
                    updatedCase.barrio || "",
                    updatedCase.punto_referencia || "No especificado",
                    updatedCase.nombre,
                    updatedCase.telefono,
                    updatedCase.cliente,
                    updatedCase.cargo,
                    updatedCase.tipo_visita,
                    linkFormulario
                ];
                await enviarWhatsAppTemplate(updatedCase.evaluador_telefono, templateName, languageCode, params);
            }
            
        } catch (notificacionError) {
            console.error("❌ Error en las notificaciones:", notificacionError.message);
        }
    } catch (error) {
        console.error('❌ Error al actualizar el caso:', error);
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// Endpoint: Subir evidencia para un caso
// -------------------------------------------------------------
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

        let { publicUrl } = supabase.storage.from('evidencias_visitas').getPublicUrl(filePath);

        if (!publicUrl || publicUrl.includes('undefined')) {
            console.warn("⚠️ [LOG] No se pudo obtener la URL pública, generando Signed URL...");
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('evidencias_visitas')
                .createSignedUrl(filePath, 60 * 60 * 24);
            if (signedUrlError) {
                console.error("❌ [LOG] Error al generar Signed URL:", signedUrlError);
                return res.status(500).json({ error: "No se pudo generar la URL pública ni la Signed URL." });
            }
            publicUrl = signedUrlData.signedUrl;
        }

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

// -------------------------------------------------------------
// Endpoint: Obtener un caso específico por ID
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Endpoint: Obtener todos los casos
// -------------------------------------------------------------
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