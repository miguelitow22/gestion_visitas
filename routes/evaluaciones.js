const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Registrar una evaluación solo si el caso existe
router.post('/', async (req, res) => {
    try {
        const { caso_id, fecha_programada } = req.body;

        if (!caso_id || !fecha_programada) {
            return res.status(400).json({ error: "❌ Se requieren 'caso_id' y 'fecha_programada'." });
        }

        console.log(`📌 [LOG] Verificando si el caso ${caso_id} existe antes de registrar evaluación.`);

        const { data: caso, error: casoError } = await supabase
            .from('casos')
            .select('id')
            .eq('id', caso_id)
            .maybeSingle();

        if (casoError) {
            console.error("❌ [LOG] Error al verificar el caso:", casoError);
            return res.status(500).json({ error: "Error al verificar el caso." });
        }

        if (!caso) {
            return res.status(404).json({ error: `❌ El caso con ID ${caso_id} no existe.` });
        }

        console.log(`✅ [LOG] Caso ${caso_id} encontrado, registrando evaluación.`);

        const { data, error } = await supabase
            .from('evaluaciones')
            .insert([{ caso_id, fecha_programada, completada: false }])
            .select();

        if (error) throw error;

        res.status(201).json({ message: '✅ Evaluación registrada con éxito.', data });

    } catch (error) {
        console.error('❌ [LOG] Error al registrar la evaluación:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener todas las evaluaciones
router.get('/', async (req, res) => {
    try {
        console.log("📌 [LOG] Obteniendo todas las evaluaciones...");
        const { data, error } = await supabase.from('evaluaciones').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('❌ [LOG] Error al obtener las evaluaciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Obtener una evaluación por ID con mejor manejo de errores
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "❌ Se requiere un ID de evaluación." });

        console.log(`📌 [LOG] Obteniendo evaluación con ID: ${id}`);
        const { data, error } = await supabase.from('evaluaciones').select('*').eq('id', id).maybeSingle();

        if (error) {
            console.error("❌ [LOG] Error al obtener la evaluación:", error);
            return res.status(500).json({ error: "Error al obtener la evaluación." });
        }

        if (!data) {
            return res.status(404).json({ error: "❌ Evaluación no encontrada." });
        }

        res.json(data);
    } catch (error) {
        console.error('❌ [LOG] Error al obtener la evaluación:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Marcar una evaluación como completada solo si aún no lo está
router.put('/:id/completar', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "❌ Se requiere un ID de evaluación." });

        console.log(`📌 [LOG] Verificando si la evaluación ${id} ya está completada.`);
        const { data: evaluacion, error: evalError } = await supabase
            .from('evaluaciones')
            .select('completada')
            .eq('id', id)
            .maybeSingle();

        if (evalError) {
            console.error("❌ [LOG] Error al buscar la evaluación:", evalError);
            return res.status(500).json({ error: "Error al buscar la evaluación." });
        }

        if (!evaluacion) {
            return res.status(404).json({ error: '❌ La evaluación no existe.' });
        }

        if (evaluacion.completada) {
            return res.status(400).json({ error: '❌ La evaluación ya estaba marcada como completada.' });
        }

        console.log(`✅ [LOG] Marcando evaluación ${id} como completada.`);
        const { data, error } = await supabase
            .from('evaluaciones')
            .update({ completada: true })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ message: '✅ Evaluación marcada como completada.', data });
    } catch (error) {
        console.error('❌ [LOG] Error al completar la evaluación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
