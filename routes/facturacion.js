// routes/facturacion.js
const express = require('express');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.get('/', async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Se requieren las fechas de inicio y fin." });
  }

  try {
    // 1. Obtener registros de la tabla "casos" filtrados por fecha_visita
    const { data, error } = await supabase
      .from('casos')
      .select('*')
      .gte('fecha_visita', startDate)
      .lte('fecha_visita', endDate);

    if (error) {
      console.error("Error en la consulta a Supabase:", error);
      return res.status(500).json({ error: "Error al obtener los registros." });
    }

    // 2. Crear un nuevo Workbook y Worksheet con ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "VerifiK";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Relación de Cobro");

    // 3. Definir las columnas del reporte (ajusta los títulos y anchos según tus necesidades)
    worksheet.columns = [
      { header: 'SOLICITUD', key: 'solicitud', width: 15 },
      { header: 'NOMBRE', key: 'nombre', width: 25 },
      { header: 'CLIENTE', key: 'cliente', width: 20 },
      { header: 'CARGO', key: 'cargo', width: 15 },
      { header: 'REGIONAL', key: 'regional', width: 15 },
      { header: 'FECHA VISITA', key: 'fecha_visita', width: 15 },
      { header: 'HORA VISITA', key: 'hora_visita', width: 15 },
      { header: 'ESTADO', key: 'estado', width: 15 },
      { header: 'TIPO VISITA', key: 'tipo_visita', width: 20 },
      { header: 'EVALUADOR', key: 'evaluador_asignado', width: 20 },
      { header: 'ANALISTA', key: 'analista_asignado', width: 20 },
      { header: 'VIÁTICOS', key: 'viaticos', width: 15 },
      { header: 'GASTOS ADICIONALES', key: 'gastos_adicionales', width: 20 },
      { header: 'PROGRAMADOR', key: 'programador', width: 20 },
    ];

    // 4. Agregar una fila por cada registro obtenido
    if (data && data.length > 0) {
      data.forEach(item => {
        worksheet.addRow({
          solicitud: item.solicitud || '',
          nombre: item.nombre || '',
          cliente: item.cliente || '',
          cargo: item.cargo || '',
          regional: item.regional || '',
          fecha_visita: item.fecha_visita ? new Date(item.fecha_visita).toLocaleDateString() : '',
          hora_visita: item.hora_visita || '',
          estado: item.estado || '',
          tipo_visita: item.tipo_visita || '',
          evaluador_asignado: item.evaluador_asignado || '',
          analista_asignado: item.analista_asignado || '',
          viaticos: item.viaticos || 0,
          gastos_adicionales: item.gastos_adicionales || 0,
          programador: item.programador || ''
        });
      });
    } else {
      worksheet.addRow({ solicitud: 'No se encontraron registros para el rango especificado.' });
    }

    // 5. Opcional: Puedes aplicar formatos a las columnas
    worksheet.getColumn('viaticos').numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';
    worksheet.getColumn('gastos_adicionales').numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';

    // 6. Convertir el workbook a buffer y enviar la respuesta
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Disposition", "attachment; filename=Relacion_de_Cobro.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("Error generando el documento:", err);
    res.status(500).json({ error: "Error al generar el documento." });
  }
});

module.exports = router;
