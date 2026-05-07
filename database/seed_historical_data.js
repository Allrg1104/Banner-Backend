const { getDB, initDB } = require('./db');

async function seedHistoricalData() {
    await initDB();
    const db = getDB();

    console.log('🌱 Iniciando carga de datos HISTÓRICOS (Periodos 1 y 2)...');

    try {
        // 1. Asegurar que los periodos existan
        const periodos = [
            { nombre: '2025-1', inicio: '2025-01-20', fin: '2025-06-15', activo: 0 },
            { nombre: '2025-2', inicio: '2025-07-07', fin: '2025-11-28', activo: 1 }
        ];

        for (const p of periodos) {
            db.prepare(`
                INSERT OR IGNORE INTO periodos (nombre, fecha_inicio, fecha_fin, activo)
                VALUES (?, ?, ?, ?)
            `).run(p.nombre, p.inicio, p.fin, p.activo);
        }

        const dbPeriods = db.prepare('SELECT id, nombre FROM periodos').all();
        const p1Id = dbPeriods.find(p => p.nombre === '2025-1').id;
        const p2Id = dbPeriods.find(p => p.nombre === '2025-2').id;

        // 2. Materias y Docentes
        const materias = db.prepare('SELECT id FROM materias').all();
        const docentes = db.prepare('SELECT id FROM personas WHERE rol = ?').all('docente');
        const estudiantes = db.prepare('SELECT id FROM estudiantes').all();

        // 3. Función para poblar un periodo
        const populatePeriod = (periodId, prefix) => {
            console.log(`Creating data for ${prefix} (ID: ${periodId})...`);
            
            // Crear 4 cursos para este periodo
            for (let i = 0; i < 4; i++) {
                const matId = materias[i % materias.length].id;
                const docId = docentes[i % docentes.length].id;
                db.prepare(`
                    INSERT OR IGNORE INTO cursos (materia_id, docente_id, periodo_id, salon, cupo, horario)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(matId, docId, periodId, `${prefix.charAt(0)}-${100 + i}`, 30, 'Horario Variable');
            }

            const cursos = db.prepare('SELECT id FROM cursos WHERE periodo_id = ?').all(periodId);

            db.transaction(() => {
                for (const est of estudiantes) {
                    // Matricular en 3 cursos
                    const myCursos = cursos.sort(() => 0.5 - Math.random()).slice(0, 3);
                    for (const c of myCursos) {
                        const res = db.prepare(`INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)`).run(est.id, c.id);
                        if (res.changes > 0) {
                            const mId = res.lastInsertRowid;
                            // Notas
                            const notaBase = Math.random() * 1.5 + 3.0; // Notas entre 3.0 y 4.5
                            db.prepare(`INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, 'Final', ?, '2025-11-01')`).run(mId, notaBase.toFixed(1));
                            // Asistencia
                            db.prepare(`INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, '2025-10-01', 'presente')`).run(mId);
                        }
                    }
                }
            })();
        };

        populatePeriod(p1Id, '2025-1');
        populatePeriod(p2Id, '2025-2');

        console.log('✅ Carga completa. Todos los estudiantes tienen datos en 2025-1 y 2025-2.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedHistoricalData();
