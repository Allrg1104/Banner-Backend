const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { calcularRiesgoEstudiante, simularEscenario } = require('../services/risk-engine.service');

/**
 * GET /api/risk/:studentId
 * Obtiene el análisis de riesgo por materia de un estudiante
 */
router.get('/:studentId', auth, (req, res) => {
    const studentId = parseInt(req.params.studentId);

    // Privacidad check
    if (req.user.rol === 'estudiante' && req.user.id !== studentId) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    try {
        const analysis = calcularRiesgoEstudiante(studentId);
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/risk/simulate
 * Simulador de escenarios académicos
 */
router.post('/simulate', auth, (req, res) => {
    const { promedio_actual, pct_asistencia, nota_esperada_final, peso_pendiente } = req.body;

    if (promedio_actual === undefined || pct_asistencia === undefined || nota_esperada_final === undefined) {
        return res.status(400).json({ error: 'Faltan parámetros para la simulación' });
    }

    try {
        const result = simularEscenario({
            promedio_actual: parseFloat(promedio_actual),
            pct_asistencia: parseFloat(pct_asistencia),
            nota_esperada_final: parseFloat(nota_esperada_final),
            peso_pendiente: parseFloat(peso_pendiente || 0)
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
