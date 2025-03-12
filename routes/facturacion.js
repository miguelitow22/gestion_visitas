// routes/facturacion.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Document, Packer, Paragraph, TextRun } = require('docx');
require('dotenv').config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.get('/', async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Se requieren las fechas de inicio y fin." });
  }

  try {
    // Consulta a la tabla "casos" filtrando por el campo fecha_visita
    const { data, error } = await supabase
      .from('casos')
      .select('*')
      .gte('fecha_visita', startDate)
      .lte('fecha_visita', endDate);

    console.log("Datos obtenidos:", data);
    if (error) {
      console.error("Error en la consulta a Supabase:", error);
      return res.status(500).json({ error: "Error al obtener los registros." });
    }

    // Definir una fila de encabezados que se mostrará siempre
    const headerRow = new Paragraph({
      children: [
        new TextRun({ text: "Solicitud", bold: true }),
        new TextRun({ text: " | " }),
        new TextRun({ text: "Nombre", bold: true }),
        new TextRun({ text: " | " }),
        new TextRun({ text: "Estado", bold: true }),
        new TextRun({ text: " | " }),
        new TextRun({ text: "Fecha Visita", bold: true }),
        new TextRun({ text: " | " }),
        new TextRun({ text: "Hora Visita", bold: true }),
        new TextRun({ text: " | " }),
        new TextRun({ text: "Tipo de Visita", bold: true }),
        new TextRun({ text: " | " }),
        new TextRun({ text: "Cliente", bold: true }),
      ]
    });

    // Si no hay registros, muestra un mensaje; de lo contrario, genera una línea por cada registro
    const registrosParagraphs = data && data.length > 0
      ? data.map(item => new Paragraph({
          children: [
            new TextRun(`${item.solicitud || ''}`),
            new TextRun({ text: " | " }),
            new TextRun({ text: `${item.nombre || ''}` }),
            new TextRun({ text: " | " }),
            new TextRun({ text: `${item.estado || ''}` }),
            new TextRun({ text: " | " }),
            new TextRun({ text: `${item.fecha_visita ? item.fecha_visita.toString() : ''}` }),
            new TextRun({ text: " | " }),
            new TextRun({ text: `${item.hora_visita ? item.hora_visita.toString() : ''}` }),
            new TextRun({ text: " | " }),
            new TextRun({ text: `${item.tipo_visita || ''}` }),
            new TextRun({ text: " | " }),
            new TextRun({ text: `${item.cliente || ''}` }),
          ]
        }))
      : [new Paragraph({ text: "No se encontraron registros para el rango especificado." })];

    // Crear el documento Word usando la sintaxis de secciones
    const doc = new Document({
      creator: "VerifiK",
      title: "Reporte de Facturación",
      sections: [
        {
          children: [
            new Paragraph({
              text: "Reporte de Facturación",
              heading: "Heading1",
            }),
            headerRow,
            ...registrosParagraphs
          ]
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Disposition", "attachment; filename=facturacion.docx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);
  } catch (err) {
    console.error("Error generando el documento:", err);
    res.status(500).json({ error: "Error al generar el documento." });
  }
});

module.exports = router;
