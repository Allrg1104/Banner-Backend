/**
 * Seed available courses for enrollment testing.
 * Restores the full academic catalog with correct schedules.
 */
const { initDB } = require('./db');

async function seedAvailable() {
    console.log('📡 Restaurando catálogo académico completo...');
    const db = await initDB();
    
    try {
        const activePeriod = db.prepare('SELECT id FROM periodos WHERE activo = 1').get();
        if (!activePeriod) throw new Error('No hay un periodo activo.');

        const oferta = [
            // CIENCIAS BÁSICAS
            { nombre: 'Cálculo Diferencial', nrc: '20001', horario: 'Lun-Mié 18:30-21:30', docente: 2 },
            { nombre: 'Cálculo Integral', nrc: '20002', horario: 'Mar-Jue 18:30-21:30', docente: 7 },
            { nombre: 'Cálculo Vectorial', nrc: '20003', horario: 'Vie 18:30-21:30', docente: 2 },
            { nombre: 'Física Mecánica', nrc: '30001', horario: 'Lun-Mié 18:30-21:30', docente: 7 },
            
            // INGENIERÍA
            { nombre: 'Programación Orientada a Objetos', nrc: '40001', horario: 'Mar-Jue 18:30-21:30', docente: 2 },
            { nombre: 'Bases de Datos II', nrc: '40002', horario: 'Sáb 18:30-21:30', docente: 7 },
            
            // IDIOMAS (I al V)
            { nombre: 'Inglés I', nrc: '50001', horario: 'Lun-Mié 18:30-21:30', docente: 2 },
            { nombre: 'Inglés II', nrc: '50002', horario: 'Mar-Jue 18:30-21:30', docente: 7 },
            { nombre: 'Inglés III', nrc: '50003', horario: 'Vie 18:30-21:30', docente: 2 },
            { nombre: 'Inglés IV', nrc: '50004', horario: 'Sáb 18:30-21:30', docente: 7 },
            { nombre: 'Inglés V', nrc: '50005', horario: 'Lun-Mié 18:30-21:30', docente: 2 }
        ];

        for (const o of oferta) {
            // Materia
            db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id) VALUES (?, ?, 3, 1)').run(o.nombre, 'MAT-'+o.nrc);
            const materiaId = db.prepare('SELECT id FROM materias WHERE nombre = ?').get(o.nombre).id;

            // Curso (Sin salón, con horario restaurado)
            db.prepare(`
                INSERT OR REPLACE INTO cursos (materia_id, docente_id, periodo_id, nrc, horario, salon, estado) 
                VALUES (?, ?, ?, ?, ?, NULL, 'activo')
            `).run(materiaId, o.docente, activePeriod.id, o.nrc, o.horario);
        }

        db.save();
        console.log('✅ Catálogo académico restaurado con éxito.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

seedAvailable();
