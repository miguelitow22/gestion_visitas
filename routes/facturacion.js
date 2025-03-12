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
            // Se recorre cada registro para crear un párrafo con los campos deseados
            ...data.map(item => new Paragraph({
              children: [
                new TextRun(`Solicitud: ${item.solicitud || ''}`),
                new TextRun({ text: `Nombre: ${item.nombre || ''}`, break: 1 }),
                new TextRun({ text: `Estado: ${item.estado || ''}`, break: 1 }),
                new TextRun({ text: `Fecha Visita: ${item.fecha_visita ? item.fecha_visita.toString() : ''}`, break: 1 }),
                new TextRun({ text: `Hora Visita: ${item.hora_visita ? item.hora_visita.toString() : ''}`, break: 1 }),
                new TextRun({ text: `Tipo de Visita: ${item.tipo_visita || ''}`, break: 1 }),
                new TextRun({ text: `Cliente: ${item.cliente || ''}`, break: 1 }),
                // Puedes agregar más campos si lo requieres, por ejemplo:
                // new TextRun({ text: `Dirección: ${item.direccion || ''}`, break: 1 }),
              ]
            }))
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
