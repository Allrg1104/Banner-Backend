const { getDB, initDB } = require('./db');

async function seedPeriod1() {
    await initDB();
    const db = getDB();

    console.log('🌱 Iniciando carga de datos para el periodo 2025-1...');

    try {
        // 1. Asegurar que el periodo 2025-1 exista (ID 1)
        const period1 = db.prepare('SELECT id FROM periodos WHERE nombre = ?').get('2025-1');
        let period1Id;
        if (!period1) {
            const result = db.prepare("INSERT INTO periodos (nombre, fecha_inicio, fecha_fin, activo) VALUES ('2025-1', '2025-01-20', '2025-06-15', 0)").run();
            period1Id = result.lastInsertRowid;
        } else {
            period1Id = period1.id;
        }

        // 2. Obtener materias y docentes para crear cursos en el periodo 1
        const materias = db.prepare('SELECT id FROM materias LIMIT 5').all();
        const docentes = db.prepare('SELECT id FROM personas WHERE rol = ?').all('docente');

        if (materias.length === 0 || docentes.length === 0) {
            throw new Error('No hay materias o docentes para crear cursos.');
        }

        console.log(`📚 Creando cursos para el periodo ID: ${period1Id}...`);
        
        // Crear cursos para el periodo 1 si no existen
        for (let i = 0; i < materias.length; i++) {
            const docenteId = docentes[i % docentes.length].id;
            db.prepare(`
                INSERT OR IGNORE INTO cursos (materia_id, docente_id, periodo_id, salon, cupo, horario)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(materias[i].id, docenteId, period1Id, `B-${100 + i}`, 30, 'Lun-Mié 10:00-12:00');
        }

        const cursosPeriodo1 = db.prepare('SELECT id FROM cursos WHERE periodo_id = ?').all(period1Id);

        // 3. Matricular a TODOS los estudiantes en estos cursos
        const estudiantes = db.prepare('SELECT id FROM estudiantes').all();
        console.log(`🎓 Matriculando ${estudiantes.length} estudiantes...`);

        db.transaction(() => {
            for (const est of estudiantes) {
                // Matricular en al menos 3 cursos aleatorios del periodo 1
                const selectedCursos = cursosPeriodo1.sort(() => 0.5 - Math.random()).slice(0, 3);
                
                for (const curso of selectedCursos) {
                    const res = db.prepare(`
                        INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id)
                        VALUES (?, ?)
                    `).run(est.id, curso.id);

                    if (res.changes > 0) {
                        const matriculaId = res.lastInsertRowid;
                        
                        // Agregar calificaciones para el periodo pasado (ya terminadas)
                        const notas = [
                            { comp: 'Corte 1', val: (Math.random() * 2 + 3).toFixed(1) },
                            { comp: 'Corte 2', val: (Math.random() * 2 + 3).toFixed(1) },
                            { comp: 'Examen Final', val: (Math.random() * 2 + 3).toFixed(1) }
                        ];

                        for (const n of notas) {
                            db.prepare(`
                                INSERT INTO calificaciones (matricula_id, componente, valor, fecha)
                                VALUES (?, ?, ?, ?)
                            `).run(matriculaId, n.comp, n.val, '2025-05-15');
                        }

                        // Agregar asistencia (90% de asistencia)
                        for (let d = 1; d <= 10; d++) {
                            const tipo = Math.random() > 0.1 ? 'presente' : 'ausente_no_justificada';
                            db.prepare(`
                                INSERT INTO asistencia (matricula_id, fecha, tipo)
                                VALUES (?, ?, ?)
                            `).run(matriculaId, `2025-03-${10 + d}`, tipo);
                        }
                    }
                }
            }
        })();

        console.log('✅ Carga de datos para 2025-1 completada con éxito.');
    } catch (err) {
        console.error('❌ Error durante la carga:', err.message);
    }
}

seedPeriod1();
