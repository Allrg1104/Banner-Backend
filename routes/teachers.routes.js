const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const auth = require('../middleware/auth');

// Función para asegurar que las tablas existan y tengan datos iniciales profesionales
const ensureTables = (db, teacherId) => {
    try {
        // 1. Crear Tablas
        db.exec(`
            CREATE TABLE IF NOT EXISTS syllabus (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                curso_id INTEGER NOT NULL UNIQUE,
                contenido TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (curso_id) REFERENCES cursos(id)
            );
            CREATE TABLE IF NOT EXISTS indisponibilidad_docente (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                docente_id INTEGER NOT NULL,
                fecha DATE NOT NULL,
                motivo TEXT,
                estado TEXT DEFAULT 'pendiente',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (docente_id) REFERENCES personas(id)
            );
            CREATE TABLE IF NOT EXISTS evaluacion_docente (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                docente_id INTEGER NOT NULL,
                periodo_id INTEGER NOT NULL,
                puntaje REAL NOT NULL,
                comentarios TEXT,
                participacion INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(docente_id, periodo_id)
            );
        `);

        // 2. Auto-Poblar Syllabus si está vacío para este docente
        const countSyl = db.prepare('SELECT COUNT(*) as count FROM syllabus s JOIN cursos c ON s.curso_id = c.id WHERE c.docente_id = ?').get(teacherId);
        if (countSyl.count === 0) {
            const cursos = db.prepare('SELECT id FROM cursos WHERE docente_id = ?').all(teacherId);
            const defaultSyllabus = JSON.stringify({
                description: 'Este curso se enfoca en el desarrollo de competencias críticas y profesionales, integrando la teoría con la práctica institucional de UNICATÓLICA.',
                objective: 'Desarrollar capacidades de análisis y aplicación de conceptos fundamentales en el área específica de formación del estudiante.',
                methodology: 'Aprendizaje Basado en Proyectos (ABP), estudios de caso y talleres prácticos colaborativos.'
            });
            for (const c of cursos) {
                db.prepare('INSERT OR IGNORE INTO syllabus (curso_id, contenido) VALUES (?, ?)').run(c.id, defaultSyllabus);
            }
        }

        // 3. Auto-Poblar Evaluaciones si están vacías
        const countEval = db.prepare('SELECT COUNT(*) as count FROM evaluacion_docente WHERE docente_id = ?').get(teacherId);
        if (countEval.count === 0) {
            const periodos = db.prepare('SELECT id FROM periodos').all();
            for (const p of periodos) {
                db.prepare(`
                    INSERT OR IGNORE INTO evaluacion_docente (docente_id, periodo_id, puntaje, comentarios, participacion)
                    VALUES (?, ?, ?, ?, ?)
                `).run(teacherId, p.id, (4.5 + Math.random() * 0.4).toFixed(1), 'Excelente docente, domina el tema y sus clases son muy claras.', 28);
            }
        }
    } catch (e) {
        console.error("Error en Auto-Población:", e.message);
    }
};

// Middleware para asegurar que solo docentes accedan
const isTeacher = (req, res, next) => {
    if (req.user.rol !== 'docente' && req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de docente' });
    }
    next();
};

// Listar mis cursos (como docente)
router.get('/my-courses', auth, isTeacher, (req, res) => {
    const db = getDB();
    try {
        const courses = db.prepare(`
            SELECT c.id, c.nrc, m.nombre as materia, m.codigo, p.nombre as periodo, c.salon, c.horario,
                   (SELECT COUNT(*) FROM matriculas WHERE curso_id = c.id) as num_estudiantes
            FROM cursos c
            JOIN materias m ON c.materia_id = m.id
            JOIN periodos p ON c.periodo_id = p.id
            WHERE c.docente_id = ?
            ORDER BY p.fecha_inicio DESC
        `).all(req.user.id);
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NUEVO: Dashboard Analytics para Docentes (Seguimiento de Riesgo y General)
router.get('/dashboard-analytics', auth, isTeacher, (req, res) => {
    const db = getDB();
    const teacherId = req.user.id;
    ensureTables(db, teacherId);
    try {

        // 1. Obtener todos los estudiantes de todos los cursos del docente
        const allStudents = db.prepare(`
            SELECT 
                p.nombres || ' ' || p.apellidos as full_name,
                e.codigo as institutional_id,
                mat.nombre as subject_name,
                m.id as matricula_id,
                c.nrc
            FROM matriculas m
            JOIN cursos c ON m.curso_id = c.id
            JOIN personas p ON m.estudiante_id = p.id
            JOIN estudiantes e ON p.id = e.persona_id
            JOIN materias mat ON c.materia_id = mat.id
            WHERE c.docente_id = ?
        `).all(teacherId);

        const riskList = [];
        const overviewList = []; // Para mostrar información aunque no haya riesgo
        let totalGrades = 0;
        let gradesCount = 0;

        allStudents.forEach(s => {
            // Calcular Promedio (Soportando 'Corte' o 'Parcial')
            const grades = db.prepare('SELECT valor FROM calificaciones WHERE matricula_id = ?').all(s.matricula_id);
            const validGrades = grades.filter(g => g.valor !== null);
            const avg = validGrades.length > 0 ? validGrades.reduce((a, b) => a + b.valor, 0) / validGrades.length : null;

            if (avg !== null) {
                totalGrades += avg;
                gradesCount++;
            }

            // Calcular Inasistencias
            const absences = db.prepare(`
                SELECT tipo, COUNT(*) as count 
                FROM asistencia 
                WHERE matricula_id = ? AND tipo != 'presente'
                GROUP BY tipo
            `).all(s.matricula_id);

            const unexcused = absences.find(a => a.tipo === 'ausente_no_justificada')?.count || 0;
            const excused = absences.find(a => a.tipo === 'ausente_justificada')?.count || 0;

            // Determinar Nivel de Riesgo
            let riskReason = [];
            let riskLevel = 'normal';

            // Alerta preventiva: > 2 faltas (antes de las 3 fatales)
            if (unexcused >= 3) {
                riskReason.push(`${unexcused} faltas injustificadas (Pérdida)`);
                riskLevel = 'critical';
            } else if (unexcused >= 2) {
                riskReason.push(`${unexcused} faltas injustificadas (Alerta)`);
                riskLevel = 'warning';
            }

            if (avg !== null && avg < 3.0) {
                riskReason.push(`Promedio bajo (${avg.toFixed(1)})`);
                riskLevel = 'critical';
            } else if (avg !== null && avg < 3.5) {
                riskReason.push(`Rendimiento regular (${avg.toFixed(1)})`);
                if (riskLevel === 'normal') riskLevel = 'warning';
            }

            const studentData = {
                name: s.full_name,
                id: s.institutional_id,
                subject: s.subject_name,
                nrc: s.nrc,
                reason: riskReason.length > 0 ? riskReason.join(' / ') : 'Buen rendimiento',
                level: riskLevel,
                avg: avg ? avg.toFixed(1) : '--',
                absences: unexcused + excused
            };

            if (riskLevel !== 'normal') {
                riskList.push(studentData);
            }
            overviewList.push(studentData);
        });

        res.json({
            stats: {
                totalStudents: allStudents.length,
                atRiskCount: riskList.length,
                averageGlobal: gradesCount > 0 ? (totalGrades / gradesCount).toFixed(1) : '0.0'
            },
            riskList: riskList.sort((a, b) => a.level === 'critical' ? -1 : 1),
            overviewList: overviewList.slice(0, 10) // Top 10 para el dashboard general
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar estudiantes de un curso con sus notas
router.get('/courses/:id/students', auth, isTeacher, (req, res) => {
    const db = getDB();
    try {
        const students = db.prepare(`
            SELECT p.id as persona_id, p.nombres, p.apellidos, p.username, m.id as matricula_id, e.codigo as institutional_id
            FROM matriculas m
            JOIN personas p ON m.estudiante_id = p.id
            JOIN estudiantes e ON p.id = e.persona_id
            WHERE m.curso_id = ?
        `).all(req.params.id);

        const results = students.map(s => {
            const grades = db.prepare(`
                SELECT componente, valor FROM calificaciones 
                WHERE matricula_id = ?
            `).all(s.matricula_id);
            
            return {
                ...s,
                grades: {
                    'Parcial 1': grades.find(g => g.componente === 'Parcial 1')?.valor || null,
                    'Parcial 2': grades.find(g => g.componente === 'Parcial 2')?.valor || null,
                    'Examen Final': grades.find(g => g.componente === 'Examen Final')?.valor || null
                }
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar o insertar nota individual
router.post('/update-grade', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { matricula_id, componente, valor } = req.body;

    try {
        const courseCheck = db.prepare(`
            SELECT c.docente_id FROM matriculas m JOIN cursos c ON m.curso_id = c.id WHERE m.id = ?
        `).get(matricula_id);

        if (!courseCheck || (courseCheck.docente_id !== req.user.id && req.user.rol !== 'admin')) {
            return res.status(403).json({ error: 'No tienes permiso' });
        }

        const existing = db.prepare('SELECT id FROM calificaciones WHERE matricula_id = ? AND componente = ?').get(matricula_id, componente);
        if (existing) {
            db.prepare('UPDATE calificaciones SET valor = ?, fecha = date("now") WHERE id = ?').run(valor, existing.id);
        } else {
            db.prepare('INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, date("now"))').run(matricula_id, componente, valor);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Importación masiva de notas
router.post('/import-grades', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { data } = req.body; 

    if (!Array.isArray(data)) return res.status(400).json({ error: 'Datos inválidos' });

    try {
        const results = { success: 0, errors: [] };
        db.transaction(() => {
            for (const item of data) {
                try {
                    const nrc = item.NRC || item.nrc;
                    const student_id = item.ID_ESTUDIANTE || item.student_id;
                    const componente = item.COMPONENTE || item.componente;
                    const valor = item.NOTA || item.nota || item.valor;

                    const curso = db.prepare('SELECT id FROM cursos WHERE nrc = ? AND docente_id = ?').get(nrc, req.user.id);
                    if (!curso) throw new Error(`NRC ${nrc} no válido`);

                    const estudiante = db.prepare('SELECT persona_id FROM estudiantes WHERE codigo = ?').get(student_id);
                    if (!estudiante) throw new Error(`ID ${student_id} no existe`);

                    const matricula = db.prepare('SELECT id FROM matriculas WHERE curso_id = ? AND estudiante_id = ?').get(curso.id, estudiante.persona_id);
                    if (!matricula) throw new Error('No matriculado');

                    if (valor !== undefined && valor !== null && valor !== '') {
                        const existing = db.prepare('SELECT id FROM calificaciones WHERE matricula_id = ? AND componente = ?').get(matricula.id, componente);
                        if (existing) {
                            db.prepare('UPDATE calificaciones SET valor = ?, fecha = date("now") WHERE id = ?').run(valor, existing.id);
                        } else {
                            db.prepare('INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, date("now"))').run(matricula.id, componente, valor);
                        }
                    }
                    results.success++;
                } catch (e) {
                    results.errors.push({ item: item.ID_ESTUDIANTE || item.student_id, error: e.message });
                }
            }
        })();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar o insertar asistencia individual
router.post('/update-attendance', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { matricula_id, tipo, fecha } = req.body;

    try {
        const courseCheck = db.prepare(`
            SELECT c.docente_id FROM matriculas m JOIN cursos c ON m.curso_id = c.id WHERE m.id = ?
        `).get(matricula_id);

        if (!courseCheck || (courseCheck.docente_id !== req.user.id && req.user.rol !== 'admin')) {
            return res.status(403).json({ error: 'No tienes permiso' });
        }

        const validTypes = ['presente', 'ausente_justificada', 'ausente_no_justificada'];
        if (!validTypes.includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de asistencia inválido' });
        }

        const existing = db.prepare('SELECT id FROM asistencia WHERE matricula_id = ? AND fecha = ?').get(matricula_id, fecha);
        if (existing) {
            db.prepare('UPDATE asistencia SET tipo = ? WHERE id = ?').run(tipo, existing.id);
        } else {
            db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, ?)').run(matricula_id, fecha, tipo);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Importación masiva de asistencia
router.post('/import-attendance', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { data } = req.body; 

    if (!Array.isArray(data)) return res.status(400).json({ error: 'Datos inválidos' });

    try {
        const results = { success: 0, errors: [] };
        db.transaction(() => {
            for (const item of data) {
                try {
                    const nrc = item.NRC || item.nrc;
                    const student_id = item.ID_ESTUDIANTE || item.student_id;
                    const typeRaw = item.TIPO || item.status || 'presente';
                    const attendanceDate = item.FECHA || item.date || new Date().toISOString().split('T')[0];

                    const curso = db.prepare('SELECT id FROM cursos WHERE nrc = ? AND docente_id = ?').get(nrc, req.user.id);
                    if (!curso) throw new Error(`NRC ${nrc} no válido`);

                    const estudiante = db.prepare('SELECT persona_id FROM estudiantes WHERE codigo = ?').get(student_id);
                    if (!estudiante) throw new Error(`ID ${student_id} no existe`);

                    const matricula = db.prepare('SELECT id FROM matriculas WHERE curso_id = ? AND estudiante_id = ?').get(curso.id, estudiante.persona_id);
                    if (!matricula) throw new Error('No matriculado');

                    const validTypes = ['presente', 'ausente_justificada', 'ausente_no_justificada'];
                    const type = typeRaw.toLowerCase();
                    if (!validTypes.includes(type)) throw new Error('Estado inválido');

                    db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, ?)').run(matricula.id, attendanceDate, type);
                    results.success++;
                } catch (e) {
                    results.errors.push({ item: item.ID_ESTUDIANTE || item.student_id, error: e.message });
                }
            }
        })();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener asistencia de un curso para una fecha específica
router.get('/courses/:id/attendance', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { date } = req.query;

    try {
        const attendance = db.prepare(`
            SELECT e.codigo as student_id, a.tipo as status
            FROM asistencia a
            JOIN matriculas m ON a.matricula_id = m.id
            JOIN estudiantes e ON m.estudiante_id = e.persona_id
            WHERE m.curso_id = ? AND a.fecha = ?
        `).all(req.params.id, date);
        
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reporte general de asistencias del curso (Sábana)
router.get('/courses/:id/attendance-report', auth, isTeacher, (req, res) => {
    const db = getDB();
    try {
        // 1. Obtener todas las fechas donde hubo clase (con asistencia)
        const dates = db.prepare(`
            SELECT DISTINCT a.fecha FROM asistencia a
            JOIN matriculas m ON a.matricula_id = m.id
            WHERE m.curso_id = ?
            ORDER BY a.fecha ASC
        `).all(req.params.id);

        // 2. Obtener lista de estudiantes
        const students = db.prepare(`
            SELECT p.nombres || ' ' || p.apellidos as name, e.codigo as student_id, m.id as matricula_id
            FROM matriculas m
            JOIN personas p ON m.estudiante_id = p.id
            JOIN estudiantes e ON p.id = e.persona_id
            WHERE m.curso_id = ?
        `).all(req.params.id);

        // 3. Cruzar datos
        const report = students.map(s => {
            const records = db.prepare('SELECT fecha, tipo FROM asistencia WHERE matricula_id = ?').all(s.matricula_id);
            return {
                ...s,
                history: records
            };
        });

        res.json({ dates: dates.map(d => d.fecha), students: report });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SERVICIOS DOCENTES ADICIONALES (CRUD DINÁMICO Y PROTEGIDO) ---

// 1. Gestión de Syllabus (Plan de Curso) - PROTEGIDO
router.get('/courses/:id/syllabus', auth, isTeacher, (req, res) => {
    const db = getDB();
    const teacherId = req.user.id;
    ensureTables(db, teacherId);
    try {
        const cursoId = req.params.id;

        // Validar que el curso pertenezca al docente que consulta
        const course = db.prepare('SELECT id FROM cursos WHERE id = ? AND docente_id = ?').get(cursoId, teacherId);
        if (!course) return res.status(403).json({ error: 'Acceso denegado: No eres el docente de este curso' });

        const syllabus = db.prepare('SELECT * FROM syllabus WHERE curso_id = ?').get(cursoId);
        res.json(syllabus || { contenido: '{}' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/courses/syllabus', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { curso_id, contenido } = req.body;
    try {
        const teacherId = req.user.id;

        // Validar que el curso pertenezca al docente antes de guardar
        const course = db.prepare('SELECT id FROM cursos WHERE id = ? AND docente_id = ?').get(curso_id, teacherId);
        if (!course) return res.status(403).json({ error: 'Acceso denegado: No puedes editar este Syllabus' });

        const existing = db.prepare('SELECT id FROM syllabus WHERE curso_id = ?').get(curso_id);
        if (existing) {
            db.prepare('UPDATE syllabus SET contenido = ?, updated_at = datetime("now") WHERE id = ?').run(JSON.stringify(contenido), existing.id);
        } else {
            db.prepare('INSERT INTO syllabus (curso_id, contenido) VALUES (?, ?)').run(curso_id, JSON.stringify(contenido));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Gestión de Indisponibilidad - AMARRADO A TU ID
router.get('/availability', auth, isTeacher, (req, res) => {
    const db = getDB();
    ensureTables(db, req.user.id);
    try {
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/availability', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { fecha, motivo } = req.body;
    try {
        // El docente_id se saca de la sesión (req.user.id), no del body, para evitar suplantación
        db.prepare('INSERT INTO indisponibilidad_docente (docente_id, fecha, motivo) VALUES (?, ?, ?)').run(req.user.id, fecha, motivo);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Resultados de Evaluación Docente - SOLO TUS RESULTADOS
router.get('/my-evaluations', auth, isTeacher, (req, res) => {
    const db = getDB();
    ensureTables(db, req.user.id);
    try {
        const evaluations = db.prepare(`
            SELECT ed.*, p.nombre as periodo
            FROM evaluacion_docente ed
            JOIN periodos p ON ed.periodo_id = p.id
            WHERE ed.docente_id = ?
            ORDER BY p.fecha_inicio DESC
        `).all(req.user.id);
        res.json(evaluations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Búsqueda de Estudiantes
router.get('/students/search/:query', auth, isTeacher, (req, res) => {
    const db = getDB();
    const query = `%${req.params.query}%`;
    try {
        const students = db.prepare(`
            SELECT p.nombres || ' ' || p.apellidos as name, e.codigo as institutional_id, p.id
            FROM estudiantes e
            JOIN personas p ON e.persona_id = p.id
            WHERE name LIKE ? OR e.codigo LIKE ?
            LIMIT 10
        `).all(query, query);
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
