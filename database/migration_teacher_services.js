const { getDB, initDB } = require('./db');

async function migrateTeacherServices() {
    await initDB();
    const db = getDB();

    console.log('🚀 Iniciando migración de Tablas para Servicios Docentes...');

    try {
        // 1. Tabla de Syllabus / Plan de Curso
        db.prepare(`
            CREATE TABLE IF NOT EXISTS syllabus (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                curso_id INTEGER NOT NULL,
                contenido TEXT, -- JSON con objetivos, temas, bibliografía
                periodo_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (curso_id) REFERENCES cursos(id),
                UNIQUE(curso_id)
            )
        `).run();

        // 2. Tabla de Indisponibilidad Docente
        db.prepare(`
            CREATE TABLE IF NOT EXISTS indisponibilidad_docente (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                docente_id INTEGER NOT NULL,
                fecha DATE NOT NULL,
                motivo TEXT,
                estado TEXT DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (docente_id) REFERENCES personas(id)
            )
        `).run();

        // 3. Tabla de Evaluación Docente (Resultados por periodo)
        db.prepare(`
            CREATE TABLE IF NOT EXISTS evaluacion_docente (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                docente_id INTEGER NOT NULL,
                periodo_id INTEGER NOT NULL,
                puntaje REAL NOT NULL, -- de 0.0 a 5.0
                comentarios TEXT,
                participacion INTEGER, -- cuántos estudiantes evaluaron
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (docente_id) REFERENCES personas(id),
                FOREIGN KEY (periodo_id) REFERENCES periodos(id),
                UNIQUE(docente_id, periodo_id)
            )
        `).run();

        // 4. Datos de prueba para Evaluación Docente (para que no esté vacío)
        const docentes = db.prepare('SELECT id FROM personas WHERE rol = "docente"').all();
        const periodo = db.prepare('SELECT id FROM periodos WHERE activo = 1').get();

        if (docentes.length > 0 && periodo) {
            for (const d of docentes) {
                db.prepare(`
                    INSERT OR IGNORE INTO evaluacion_docente (docente_id, periodo_id, puntaje, comentarios, participacion)
                    VALUES (?, ?, ?, ?, ?)
                `).run(d.id, periodo.id, (Math.random() * 1 + 4).toFixed(1), 'Excelente desempeño académico y pedagógico.', 25);
            }
        }

        console.log('✅ Migración completada con éxito.');
    } catch (err) {
        console.error('❌ Error en la migración:', err);
    }
}

migrateTeacherServices();
