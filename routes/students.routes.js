const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getStudentDashboardMetrics } = require('../services/analytics.service');

// Solo estudiantes o admin/registro/director/decano pueden ver el dashboard de un estudiante
router.get('/:id/dashboard', auth, (req, res) => {
    const targetId = parseInt(req.params.id);

    // Seguridad: Estudiante solo ve el suyo. Otros roles (ver rbac) pueden ver cualquiera.
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) {
        return res.status(403).json({ error: 'No tienes permiso para ver este dashboard' });
    }

    try {
        const metrics = getStudentDashboardMetrics(targetId);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/grades', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) return res.status(403).json({ error: 'Acceso denegado' });

    const db = getDB();
    const grades = db.prepare(`
    SELECT mat.nombre as materia, c.componente, c.valor, c.porcentaje, c.fecha
    FROM matriculas m
    JOIN calificaciones c ON m.id = c.matricula_id
    JOIN cursos cu ON m.curso_id = cu.id
    JOIN materias mat ON cu.materia_id = mat.id
    JOIN periodos p ON cu.periodo_id = p.id
    WHERE m.estudiante_id = ? AND p.activo = 1
    ORDER BY mat.nombre, c.fecha
  `).all(targetId);

    res.json(grades);
});

router.get('/:id/attendance', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) return res.status(403).json({ error: 'Acceso denegado' });

    const db = getDB();
    const attendance = db.prepare(`
    SELECT mat.nombre as materia, a.fecha, a.tipo, a.observacion
    FROM matriculas m
    JOIN asistencia a ON m.id = a.matricula_id
    JOIN cursos cu ON m.curso_id = cu.id
    JOIN materias mat ON cu.materia_id = mat.id
    JOIN periodos p ON cu.periodo_id = p.id
    WHERE m.estudiante_id = ? AND p.activo = 1
    ORDER BY a.fecha DESC
  `).all(targetId);

    res.json(attendance);
});

module.exports = router;
