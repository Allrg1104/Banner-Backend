const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getDirectorKPIs } = require('../services/analytics.service');

router.get('/dashboard', auth, rbac('director', 'decano', 'admin'), (req, res) => {
    try {
        const db = require('../database/db').getDB();
        const directorId = req.user.id;

        // 1. Obtener el programa del director
        const programa = db.prepare('SELECT id, nombre FROM programas WHERE director_id = ?').get(directorId);
        
        if (!programa) {
            // Si no tiene programa asignado, devolver kpis vacios o generales
            const kpis = getDirectorKPIs();
            return res.json({ ...kpis, my_program: null, students: [] });
        }

        // 2. Obtener estudiantes del programa
        const students = db.prepare(`
            SELECT e.id, p.id as persona_id, p.nombres, p.apellidos, e.codigo, p.email, e.semestre_actual, e.promedio_acumulado, e.estado
            FROM estudiantes e
            JOIN personas p ON e.persona_id = p.id
            WHERE e.programa_id = ?
        `).all(programa.id);

        // 3. Para cada estudiante, obtener sus cursos y notas actuales
        const studentsWithCourses = students.map(st => {
            const courses = db.prepare(`
                SELECT c.id, m.nombre as materia, c.nrc, p_doc.nombres || ' ' || p_doc.apellidos as docente,
                COALESCE((SELECT AVG(valor) FROM calificaciones WHERE matricula_id = mat.id AND valor IS NOT NULL), 0) as promedio
                FROM matriculas mat
                JOIN cursos c ON mat.curso_id = c.id
                JOIN materias m ON c.materia_id = m.id
                JOIN personas p_doc ON c.docente_id = p_doc.id
                JOIN periodos per ON c.periodo_id = per.id
                WHERE mat.estudiante_id = ? AND per.activo = 1
            `).all(st.persona_id); 
            return { ...st, courses }; 
        });

        const kpis = getDirectorKPIs();
        res.json({ ...kpis, my_program: programa, students: studentsWithCourses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
