const { getDB, initDB } = require('./db');
const bcrypt = require('bcryptjs');

async function seedGenericStudent() {
    const username = process.argv[2];
    if (!username) {
        console.error('❌ Por favor especifica un username. Ejemplo: node seed_generic_student.js 400055');
        process.exit(1);
    }

    await initDB();
    const db = getDB();

    try {
        console.log(`🚀 Iniciando carga de datos para el usuario: ${username}...`);

        // 1. Obtener o crear persona
        let persona = db.prepare('SELECT id, nombres FROM personas WHERE username = ?').get(username);
        
        if (!persona) {
            const passwordHash = bcrypt.hashSync('Temp2024!', 10);
            const res = db.prepare(`
                INSERT INTO personas (nombres, apellidos, email, username, password_hash, rol, documento, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                'Estudiante', 
                username, 
                `${username}@unicatolica.edu.co`, 
                username, 
                passwordHash, 
                'estudiante', 
                `DOC-${username}`, 
                0
            );
            persona = { id: res.lastInsertRowid, nombres: 'Estudiante' };
            console.log(`✅ Usuario ${username} creado.`);
        } else {
            console.log(`ℹ️ El usuario ${persona.nombres} (${username}) ya existe. Actualizando datos...`);
        }

        // 2. Asegurar registro en tabla estudiantes
        db.prepare(`
            INSERT OR IGNORE INTO estudiantes (persona_id, programa_id, codigo, semestre_actual, promedio_acumulado)
            VALUES (?, 1, 'COD-${username}', 5, 3.9)
        `).run(persona.id);

        // 3. Recursos necesarios
        const p1Id = db.prepare('SELECT id FROM periodos WHERE nombre = ?').get('2025-1')?.id;
        const p2Id = db.prepare('SELECT id FROM periodos WHERE nombre = ?').get('2025-2')?.id;
        const materias = db.prepare('SELECT id FROM materias').all();
        const docentes = db.prepare('SELECT id FROM personas WHERE rol = ?').all('docente');

        if (!p1Id || !p2Id) {
            console.error('❌ Error: Faltan los periodos 2025-1/2025-2 en la BD.');
            return;
        }

        // 4. Poblar Datos Académicos
        const populate = (periodId, prefix) => {
            console.log(`- Cargando materias para ${prefix}...`);
            const cursos = db.prepare('SELECT id FROM cursos WHERE periodo_id = ?').all(periodId);
            
            db.transaction(() => {
                for (let i = 0; i < 7; i++) {
                    const cursoId = cursos[i % cursos.length].id;
                    const res = db.prepare(`INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)`).run(persona.id, cursoId);
                    let mId = res.changes > 0 ? res.lastInsertRowid : db.prepare('SELECT id FROM matriculas WHERE estudiante_id = ? AND curso_id = ?').get(persona.id, cursoId).id;

                    // 3 Notas por materia
                    db.prepare('DELETE FROM calificaciones WHERE matricula_id = ?').run(mId);
                    ['Parcial 1', 'Parcial 2', 'Examen Final'].forEach(comp => {
                        db.prepare(`INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, ?)`).run(mId, comp, (Math.random() * 2 + 3).toFixed(1), '2025-06-01');
                    });
                    // Asistencia
                    db.prepare(`INSERT OR IGNORE INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, 'presente')`).run(mId, '2025-05-15');
                }
            })();
        };

        populate(p1Id, '2025-1');
        populate(p2Id, '2025-2');

        // 5. Historial de Solicitudes
        console.log('- Generando historial de solicitudes...');
        db.prepare('DELETE FROM solicitudes WHERE estudiante_id = ?').run(persona.id);
        const reqs = [
            { t: 'Certificados Académicos: Certificado de Estudio', e: 'aprobada', r: 'Documento listo para descargar.' },
            { t: 'Certificados Académicos: Certificado de Notas', e: 'aprobada', r: 'Verificado satisfactoriamente.' },
            { t: 'Solicitudes Académicas: Reintegro', e: 'pendiente', r: null },
            { t: 'Solicitudes Financieras: Certificado Financiero', e: 'en_proceso', r: 'Validando con tesorería.' },
            { t: 'Certificados Académicos: Certificado de Horario', e: 'aprobada', r: 'Carga académica confirmada.' }
        ];

        db.transaction(() => {
            reqs.forEach((r, idx) => {
                db.prepare(`INSERT INTO solicitudes (estudiante_id, tipo, estado, descripcion, respuesta, fecha) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`)
                  .run(persona.id, r.t, r.e, `Trámite generado para ${username}.`, r.r, `-${idx * 3} days`);
            });
        })();

        console.log(`✅ PROCESO COMPLETADO. El usuario ${username} tiene su historial académico full.`);
        process.exit(0);

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedGenericStudent();
