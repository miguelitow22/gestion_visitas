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
    // 1. Obtenemos todos los casos en el rango de fechas
    const { data, error } = await supabase
      .from('casos')
      .select('*')
      .gte('fecha_visita', startDate)
      .lte('fecha_visita', endDate);

    if (error) {
      console.error("Error en la consulta a Supabase:", error);
      return res.status(500).json({ error: "Error al obtener los registros." });
    }

    // 2. Creamos el workbook y worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "VerifiK";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Reporte de Cobro');

    // 3. Estilos iniciales o tamaños de columna
    // (Ajusta según tus columnas reales; esto es sólo un ejemplo)
    worksheet.columns = [
      { header: 'CANTIDAD', key: 'cantidad', width: 10 },
      { header: 'GRUPO ARMADO', key: 'grupo_armado', width: 20 },
      { header: 'NOMBRE VISITADO', key: 'nombre_visitado', width: 25 },
      { header: 'NOMBRE EVALUADO', key: 'nombre_evaluado', width: 25 },
      { header: 'CLIENTE', key: 'cliente', width: 20 },
      { header: 'CARGO', key: 'cargo', width: 15 },
      { header: 'CIUDAD', key: 'ciudad', width: 20 },
      { header: 'FECHA VISITA', key: 'fecha_visita', width: 15 },
      { header: 'HORA VISITA', key: 'hora_visita', width: 15 },
      { header: 'NOMBRE EVALUADOR', key: 'evaluador_asignado', width: 20 },
      { header: 'FORMA DE PAGO', key: 'forma_de_pago', width: 20 },
      { header: 'SUBTOTAL', key: 'subtotal', width: 15 }
    ];

    // 4. Agrupar los registros por "regional"
    //    Suponiendo que en la tabla tienes un campo "regional". De lo contrario, ajústalo.
    const registrosPorRegional = {};
    data.forEach(item => {
      const region = item.regional || "SIN REGIONAL";
      if (!registrosPorRegional[region]) {
        registrosPorRegional[region] = [];
      }
      registrosPorRegional[region].push(item);
    });

    // 5. Para cada "regional", escribimos el título, luego el header y los datos
    let totalGlobal = 0;

    Object.keys(registrosPorRegional).forEach((region) => {
      const items = registrosPorRegional[region];
      
      // 5.1. Agregamos una fila combinada para título "REGIONAL: X"
      const startRow = worksheet.lastRow ? worksheet.lastRow.number + 2 : 1; // Deja 1 fila vacía
      const endCol = worksheet.columns.length; // Ej: 12
      // Combinamos celdas en la fila "startRow"
      worksheet.mergeCells(startRow, 1, startRow, endCol);
      worksheet.getCell(startRow, 1).value = `REGIONAL: ${region}`;
      worksheet.getCell(startRow, 1).font = { bold: true };
      worksheet.getCell(startRow, 1).alignment = { horizontal: 'center' };

      // 5.2. Encabezado (ya lo define "columns", pero si quieres repetir, hazlo manual)
      // Normalmente, el header se crea una sola vez si el reporte es corrido,
      // pero si deseas el header repetido para cada region, podrías forzarlo otra vez.
      // Ejemplo: worksheet.addRow(); 
      // worksheet.addRow({cantidad: 'CANTIDAD', grupo_armado: 'GRUPO ARMADO', ...})

      // 5.3. Insertar filas de esta "regional"
      let subtotalRegional = 0;

      items.forEach(item => {
        // Ejemplo simple: la "cantidad" y "grupo_armado" no existen en tu BD, ajusta según tus campos reales.
        const rowData = {
          cantidad: 1, // si manejas "1 visita" por fila
          grupo_armado: item.grupo_armado || "",  // si existiera
          nombre_visitado: item.nombre || "",      // item.nombre ?? 
          nombre_evaluado: "",                     // si tienes un campo "nombre_evaluado"
          cliente: item.cliente || "",
          cargo: item.cargo || "",
          ciudad: item.ciudad || "",
          fecha_visita: item.fecha_visita ? new Date(item.fecha_visita).toLocaleDateString() : "",
          hora_visita: item.hora_visita || "",
          evaluador_asignado: item.evaluador_asignado || "",
          forma_de_pago: item.forma_de_pago || "",
          subtotal: 100000 // O la lógica para calcular el subtotal de esa visita
        };
        
        worksheet.addRow(rowData);

        // Suma al subtotal regional (puede ser un campo de la BD, o calculado).
        // Por ejemplo, si tienes item.valor, item.gastos_adicionales, etc.
        subtotalRegional += 100000; 
      });

      // 5.4. Fila de SUBTOTAL de la regional
      const subtotalRow = worksheet.addRow({});
      const lastColumn = worksheet.columns.length; 
      // Combinar celdas para poner el texto "SUBTOTAL" al final
      worksheet.mergeCells(subtotalRow.number, 1, subtotalRow.number, lastColumn - 1);
      worksheet.getCell(subtotalRow.number, 1).value = 'SUBTOTAL:';
      worksheet.getCell(subtotalRow.number, 1).alignment = { horizontal: 'right' };
      worksheet.getCell(subtotalRow.number, lastColumn).value = subtotalRegional;
      worksheet.getCell(subtotalRow.number, lastColumn).font = { bold: true };

      totalGlobal += subtotalRegional;
    });

    // 6. Fila de TOTAL GLOBAL
    const totalRow = worksheet.addRow({});
    const lastColumn = worksheet.columns.length;
    worksheet.mergeCells(totalRow.number, 1, totalRow.number, lastColumn - 1);
    worksheet.getCell(totalRow.number, 1).value = 'TOTAL A PAGAR:';
    worksheet.getCell(totalRow.number, 1).alignment = { horizontal: 'right' };
    worksheet.getCell(totalRow.number, lastColumn).value = totalGlobal;
    worksheet.getCell(totalRow.number, lastColumn).font = { bold: true };

    // 7. Convertir el workbook a buffer y enviar
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
