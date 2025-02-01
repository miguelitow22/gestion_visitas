const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Registrar una evaluación solo si el caso existe
router.post('/', async (req, res) => {
    const { caso_id, fecha_programada } = req.body;

    // Verificar si el caso existe
    const { data: caso, error: casoError } = await supabase.from('casos').select('id').eq('id', caso_id).single();
    if (casoError || !caso) {
        return res.status(400).json({ error: 'El caso no existe' });
    }

    const { data, error } = await supabase
        .from('evaluaciones')
        .insert([{ caso_id, fecha_programada, completada: false }]);

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
});

// ✅ Obtener todas las evaluaciones
router.get('/', async (req, res) => {
    const { data, error } = await supabase.from('evaluaciones').select('*');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// ✅ Obtener una evaluación por ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from('evaluaciones').select('*').eq('id', id).single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// ✅ Marcar una evaluación como completada solo si aún no lo está
router.put('/:id/completar', async (req, res) => {
    const { id } = req.params;

    // Verificar si la evaluación ya está completada
    const { data: evaluacion, error: evalError } = await supabase.from('evaluaciones').select('completada').eq('id', id).single();
    if (evalError || !evaluacion) {
        return res.status(400).json({ error: 'La evaluación no existe' });
    }
    if (evaluacion.completada) {
        return res.status(400).json({ error: 'La evaluación ya está completada' });
    }

    const { data, error } = await supabase
        .from('evaluaciones')
        .update({ completada: true })
        .eq('id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Evaluación completada', data });
});

module.exports = router;
