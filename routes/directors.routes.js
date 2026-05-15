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

/**
 * Asistencias del programa del director (periodo lectivo activo).
 * Agrega presentes / inasistencias por estudiante; alerta si inasistencias > 3.
 */
router.get('/attendance', auth, rbac('director', 'decano', 'admin'), (req, res) => {
    try {
        const db = require('../database/db').getDB();
        const directorId = req.user.id;

        const programa = db.prepare('SELECT id, nombre FROM programas WHERE director_id = ?').get(directorId);

        if (!programa) {
            return res.json({
                my_program: null,
                students: [],
                summary: {
                    total_estudiantes: 0,
                    estudiantes_con_alerta: 0,
                    total_inasistencias: 0,
                    total_presentes: 0
                }
            });
        }

        const rows = db.prepare(`
            SELECT
                p.id AS persona_id,
                p.nombres,
                p.apellidos,
                e.codigo,
                COALESCE(SUM(CASE WHEN per.activo = 1 AND a.tipo = 'presente' THEN 1 ELSE 0 END), 0) AS presentes,
                COALESCE(SUM(CASE WHEN per.activo = 1 AND a.tipo = 'ausente_no_justificada' THEN 1 ELSE 0 END), 0) AS inasistencias_injustificadas,
                COALESCE(SUM(CASE WHEN per.activo = 1 AND a.tipo = 'ausente_justificada' THEN 1 ELSE 0 END), 0) AS inasistencias_justificadas
            FROM estudiantes e
            JOIN personas p ON e.persona_id = p.id
            LEFT JOIN matriculas m ON m.estudiante_id = p.id
            LEFT JOIN cursos cu ON m.curso_id = cu.id
            LEFT JOIN periodos per ON cu.periodo_id = per.id
            LEFT JOIN asistencia a ON a.matricula_id = m.id
            WHERE e.programa_id = ?
            GROUP BY p.id, p.nombres, p.apellidos, e.codigo
            ORDER BY inasistencias_injustificadas DESC, inasistencias_justificadas DESC, p.apellidos, p.nombres
        `).all(programa.id);

        const students = rows.map((r) => ({
            ...r,
            inasistencias: r.inasistencias_injustificadas + r.inasistencias_justificadas,
            alerta_alta_inasistencia: r.inasistencias_injustificadas >= 3 || r.inasistencias_justificadas >= 5,
            alerta_riesgo: r.inasistencias_injustificadas === 2 || r.inasistencias_justificadas === 4,
            total_registros: r.presentes + r.inasistencias_injustificadas + r.inasistencias_justificadas
        }));

        const summary = {
            total_estudiantes: students.length,
            estudiantes_con_alerta: students.filter((s) => s.alerta_alta_inasistencia || s.alerta_riesgo).length,
            total_inasistencias: students.reduce((acc, s) => acc + s.inasistencias, 0),
            total_presentes: students.reduce((acc, s) => acc + s.presentes, 0)
        };

        res.json({ 
            my_program: programa, 
            students, 
            summary, 
            reglas: { 
                max_injustificadas: 3, 
                max_justificadas: 5 
            } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
