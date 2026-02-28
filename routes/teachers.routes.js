const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getTeacherDashboardMetrics } = require('../services/analytics.service');

router.get('/:id/dashboard', auth, rbac('docente', 'admin'), (req, res) => {
    try {
        const metrics = getTeacherDashboardMetrics(req.params.id);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listado de estudiantes en un curso
router.get('/courses/:courseId/students', auth, rbac('docente', 'admin', 'registro'), (req, res) => {
    const db = getDB();
    const students = db.prepare(`
    SELECT p.id, p.nombres, p.apellidos, e.codigo, m.id as matricula_id
    FROM personas p
    JOIN matriculas m ON p.id = m.estudiante_id
    JOIN estudiantes e ON p.id = e.persona_id
    WHERE m.curso_id = ?
  `).all(req.params.courseId);
    res.json(students);
});

// Registrar nota
router.post('/grades', auth, rbac('docente', 'admin'), (req, res) => {
    const { matricula_id, componente, valor, porcentaje, observacion } = req.body;
    const db = getDB();
    db.prepare(`
    INSERT INTO calificaciones (matricula_id, componente, valor, porcentaje, observacion)
    VALUES (?, ?, ?, ?, ?)
  `).run(matricula_id, componente, valor, porcentaje, observacion);
    res.json({ message: 'Nota registrada' });
});

// Registrar asistencia
router.post('/attendance', auth, rbac('docente', 'admin'), (req, res) => {
    const { matricula_id, fecha, tipo, observacion } = req.body;
    const db = getDB();
    db.prepare(`
    INSERT INTO asistencia (matricula_id, fecha, tipo, observacion)
    VALUES (?, ?, ?, ?)
  `).run(matricula_id, fecha, tipo, observacion);
    res.json({ message: 'Asistencia registrada' });
});

module.exports = router;
