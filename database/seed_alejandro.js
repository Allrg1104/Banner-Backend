const { getDB, initDB } = require('./db');
const bcrypt = require('bcryptjs');

async function seedAlejandro() {
    await initDB();
    const db = getDB();

    try {
        console.log('🚀 Iniciando carga de datos para Alejandro Rivera...');

        // 1. Crear la persona si no existe (Buscamos por username o email)
        let persona = db.prepare('SELECT id FROM personas WHERE username = ? OR email = ?').get('alejandro.rivera01', 'alejandro.rivera01@unicatolica.edu.co');
        
        if (!persona) {
            const passwordHash = bcrypt.hashSync('Temp2024!', 10);
            const res = db.prepare(`
                INSERT INTO personas (nombres, apellidos, email, username, password_hash, rol, documento, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                'Alejandro', 
                'Rivera', 
                'alejandro.rivera01@unicatolica.edu.co', 
                'alejandro.rivera01', 
                passwordHash, 
                'estudiante', 
                '1020304050', 
                0
            );
            persona = { id: res.lastInsertRowid };
            console.log('✅ Usuario Alejandro creado.');
        } else {
            console.log('ℹ️ El usuario Alejandro ya existe. Actualizando sus datos académicos...');
        }

        // 2. Asegurar que esté en la tabla de estudiantes
        db.prepare(`
            INSERT OR IGNORE INTO estudiantes (persona_id, programa_id, codigo, semestre_actual, promedio_acumulado)
            VALUES (?, 1, '202510999', 4, 4.2)
        `).run(persona.id);

        // 3. Obtener periodos, materias y docentes
        const p1Id = db.prepare('SELECT id FROM periodos WHERE nombre = ?').get('2025-1')?.id;
        const p2Id = db.prepare('SELECT id FROM periodos WHERE nombre = ?').get('2025-2')?.id;
        const materias = db.prepare('SELECT id FROM materias').all();
        const docentes = db.prepare('SELECT id FROM personas WHERE rol = ?').all('docente');

        if (!p1Id || !p2Id) {
            console.error('❌ Error: No se encontraron los periodos 2025-1 y 2025-2 en la BD.');
            return;
        }

        // 4. Poblar datos académicos por periodo
        const populateStudentData = (periodId, prefix) => {
            console.log(`Cargando materias y notas para ${prefix}...`);
            
            // Asegurar que existan cursos para este periodo
            for (let i = 0; i < 7; i++) {
                db.prepare(`
                    INSERT OR IGNORE INTO cursos (materia_id, docente_id, periodo_id, salon, cupo, horario)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(materias[i % materias.length].id, docentes[i % docentes.length].id, periodId, `A-${200+i}`, 30, 'L-M-W 08:00');
            }

            const cursos = db.prepare('SELECT id FROM cursos WHERE periodo_id = ?').all(periodId);
            
            db.transaction(() => {
                for (let i = 0; i < 7; i++) {
                    const cursoId = cursos[i].id;
                    const res = db.prepare(`INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)`).run(persona.id, cursoId);
                    
                    let mId = res.changes > 0 ? res.lastInsertRowid : db.prepare('SELECT id FROM matriculas WHERE estudiante_id = ? AND curso_id = ?').get(persona.id, cursoId).id;

                    // Notas (3 por materia)
                    db.prepare('DELETE FROM calificaciones WHERE matricula_id = ?').run(mId);
                    const componentes = ['Parcial 1', 'Parcial 2', 'Examen Final'];
                    componentes.forEach((comp, idx) => {
                        const valor = (Math.random() * 1.5 + 3.5).toFixed(1); // Buenas notas para Alejandro
                        db.prepare(`INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, ?)`).run(mId, comp, valor, '2025-05-01');
                    });

                    // Asistencia
                    db.prepare(`INSERT OR IGNORE INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, 'presente')`).run(mId, '2025-04-01');
                }
            })();
        };

        populateStudentData(p1Id, '2025-1');
        populateStudentData(p2Id, '2025-2');

        // 5. Generar solicitudes para Alejandro
        console.log('Cargando historial de solicitudes...');
        db.prepare('DELETE FROM solicitudes WHERE estudiante_id = ?').run(persona.id);
        
        const requests = [
            { tipo: 'Certificados Académicos: Certificado de Estudio', estado: 'aprobada', res: 'Tu certificado ha sido generado. Puedes descargarlo ahora.' },
            { tipo: 'Certificados Académicos: Certificado de Notas', estado: 'aprobada', res: 'Documento disponible para descarga.' },
            { tipo: 'Solicitudes Académicas: Reingreso', estado: 'pendiente', res: null },
            { tipo: 'Solicitudes Financieras: Certificado Financiero', estado: 'en_proceso', res: 'Estamos verificando tus pagos.' },
            { tipo: 'Certificados Académicos: Certificado de Horario', estado: 'aprobada', res: 'Horario validado exitosamente.' }
        ];

        db.transaction(() => {
            requests.forEach((req, i) => {
                db.prepare(`
                    INSERT INTO solicitudes (estudiante_id, tipo, estado, descripcion, respuesta, fecha)
                    VALUES (?, ?, ?, ?, ?, datetime('now', ?))
                `).run(persona.id, req.tipo, req.estado, 'Trámite solicitado por Alejandro Rivera.', req.res, `-${i * 2} days`);
            });
        })();

        console.log('✅ TODO LISTO. Alejandro Rivera ya tiene su vida académica completa en el sistema.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error fatal:', err.message);
        process.exit(1);
    }
}

seedAlejandro();
