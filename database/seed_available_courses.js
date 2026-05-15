/**
 * Seed available courses for enrollment testing.
 */
const { initDB } = require('./db');

async function seedAvailable() {
    console.log('📡 Cargando oferta académica para inscripciones...');
    const db = await initDB();
    
    try {
        const activePeriod = db.prepare('SELECT id FROM periodos WHERE activo = 1').get();
        if (!activePeriod) throw new Error('No hay un periodo activo.');

        const oferta = [
            { nombre: 'Cálculo Diferencial', nrc: '20001', horario: 'Lun-Mié 18:30-21:30', salon: null, docente: 2 },
            { nombre: 'Cálculo Integral', nrc: '20002', horario: 'Mar-Jue 18:30-21:30', salon: null, docente: 7 },
            { nombre: 'Cálculo Vectorial', nrc: '20003', horario: 'Vie 18:30-21:30', salon: null, docente: 2 },
            { nombre: 'Física Mecánica', nrc: '30001', horario: 'Lun-Mié 18:30-21:30', salon: null, docente: 7 },
            { nombre: 'Programación Orientada a Objetos', nrc: '40001', horario: 'Mar-Jue 18:30-21:30', salon: null, docente: 2 },
            { nombre: 'Bases de Datos II', nrc: '40002', horario: 'Sáb 18:30-21:30', salon: null, docente: 7 },
            { nombre: 'Inglés I', nrc: '50001', horario: 'Lun-Mié 18:30-21:30', salon: null, docente: 2 },
            { nombre: 'Inglés II', nrc: '50002', horario: 'Mar-Jue 18:30-21:30', salon: null, docente: 7 },
            { nombre: 'Inglés III', nrc: '50003', horario: 'Vie 18:30-21:30', salon: null, docente: 2 },
            { nombre: 'Inglés IV', nrc: '50004', horario: 'Sáb 18:30-21:30', salon: null, docente: 7 },
            { nombre: 'Inglés V', nrc: '50005', horario: 'Lun-Mié 18:30-21:30', salon: null, docente: 2 }
        ];

        for (const o of oferta) {
            // Materia
            db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id) VALUES (?, ?, 3, 1)').run(o.nombre, 'MAT-'+o.nrc);
            const materiaId = db.prepare('SELECT id FROM materias WHERE nombre = ?').get(o.nombre).id;

            // Curso
            db.prepare('INSERT OR IGNORE INTO cursos (materia_id, docente_id, periodo_id, nrc, horario, salon, estado) VALUES (?, ?, ?, ?, ?, ?, "activo")').run(
                materiaId, o.docente, activePeriod.id, o.nrc, o.horario, o.salon
            );
        }

        db.save();
        console.log('✅ Oferta académica cargada correctamente.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

seedAvailable();
