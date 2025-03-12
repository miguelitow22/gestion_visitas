// routes/facturacion.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Document, Packer, Paragraph, TextRun } = require('docx');
require('dotenv').config();

const router = express.Router();

// Inicializamos el cliente de Supabase con las variables de entorno
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Endpoint para generar el documento de facturación
router.get('/', async (req, res) => {
  // Se esperan los parámetros startDate y endDate en la query
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Se requieren las fechas de inicio y fin." });
  }

  try {
    // Consultamos la tabla "casos" filtrando por el campo "fecha_visita"
    const { data, error } = await supabase
      .from('casos')
      .select('*')
      .gte('fecha_visita', startDate)
      .lte('fecha_visita', endDate);

    if (error) {
      console.error("Error al obtener registros:", error);
      return res.status(500).json({ error: "Error al obtener los registros." });
    }

    // Creamos el documento Word
    const doc = new Document();

    // Párrafo con el título del reporte
    const titleParagraph = new Paragraph({
      text: "Reporte de Facturación",
      heading: "Heading1",
    });

    // Creamos un párrafo para cada registro obtenido
    const registrosParagraphs = data.map(item => {
      return new Paragraph({
        children: [
          new TextRun(`Solicitud: ${item.solicitud}`),
          new TextRun({ text: `Nombre: ${item.nombre}`, break: 1 }),
          new TextRun({ text: `Fecha Visita: ${item.fecha_visita}`, break: 1 }),
          new TextRun({ text: `Tipo de Visita: ${item.tipo_visita}`, break: 1 }),
          // Agrega aquí otros campos que consideres necesarios
        ],
      });
    });

    // Se agrega una sección al documento con el título y los registros
    doc.addSection({
      children: [titleParagraph, ...registrosParagraphs],
    });

    // Convertimos el documento a un buffer
    const buffer = await Packer.toBuffer(doc);

    // Configuramos los headers para que el navegador descargue el archivo
    res.setHeader("Content-Disposition", "attachment; filename=facturacion.docx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    
    // Enviamos el buffer como respuesta
    res.send(buffer);
  } catch (err) {
    console.error("Error generando el documento:", err);
    res.status(500).json({ error: "Error al generar el documento." });
  }
});

module.exports = router;
