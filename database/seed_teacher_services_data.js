const { getDB, initDB } = require('./db');

async function seedTeacherServices() {
    await initDB();
    const db = getDB();

    console.log('🌱 Iniciando carga de DATOS PROFESIONALES para Servicios Docentes...');

    try {
        // 1. Identificar al Docente (Ricardo o el docente actual)
        const ricardo = db.prepare('SELECT id FROM personas WHERE nombres LIKE "%Ricardo%" AND rol = "docente"').get();
        if (!ricardo) {
            console.log('⚠️ No se encontró al docente Ricardo. Saltando carga específica.');
            return;
        }

        // 2. Obtener sus cursos
        const cursos = db.prepare('SELECT id, materia_id FROM cursos WHERE docente_id = ?').all(ricardo.id);

        // 3. Poblar Syllabus con contenido estándar profesional
        const syllabusData = {
            'Ética y Valores': {
                description: 'Este curso explora los fundamentos de la ética ciudadana y profesional en el contexto contemporáneo, promoviendo el desarrollo de valores íntegros para el ejercicio de la profesión.',
                objective: 'Desarrollar en el estudiante capacidades de reflexión crítica sobre los dilemas éticos actuales y su impacto en la sociedad.',
                methodology: 'Aprendizaje basado en problemas, debates dirigidos y estudios de caso prácticos.'
            },
            'Default': {
                description: 'Descripción general del curso enfocada en el desarrollo de competencias institucionales y académicas de alto nivel.',
                objective: 'Fortalecer el conocimiento técnico y práctico del estudiante en el área específica de estudio.',
                methodology: 'Clases magistrales activas con apoyo de herramientas digitales y trabajo colaborativo.'
            }
        };

        for (const c of cursos) {
            const materia = db.prepare('SELECT nombre FROM materias WHERE id = ?').get(c.materia_id);
            const content = syllabusData[materia.nombre] || syllabusData['Default'];
            
            db.prepare(`
                INSERT OR REPLACE INTO syllabus (curso_id, contenido, updated_at)
                VALUES (?, ?, datetime('now'))
            `).run(c.id, JSON.stringify(content));
        }

        // 4. Poblar Evaluaciones Docentes Históricas
        const periodos = db.prepare('SELECT id FROM periodos').all();
        for (let i = 0; i < periodos.length; i++) {
            db.prepare(`
                INSERT OR IGNORE INTO evaluacion_docente (docente_id, periodo_id, puntaje, comentarios, participacion)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                ricardo.id, 
                periodos[i].id, 
                (4.2 + (Math.random() * 0.7)).toFixed(1), 
                'Excelente dominio del tema. Sus clases son muy dinámicas y promueven la participación.',
                20 + Math.floor(Math.random() * 10)
            );
        }

        // 5. Poblar historial de Indisponibilidad
        const hoy = new Date().toISOString().split('T')[0];
        db.prepare(`
            INSERT OR IGNORE INTO indisponibilidad_docente (docente_id, fecha, motivo, estado)
            VALUES (?, ?, ?, ?)
        `).run(ricardo.id, hoy, 'Asistencia a Congreso de Ética Profesional', 'aprobado');

        console.log('✅ Datos profesionales cargados correctamente en la Base de Datos.');
    } catch (err) {
        console.error('❌ Error cargando datos:', err);
    }
}

seedTeacherServices();
