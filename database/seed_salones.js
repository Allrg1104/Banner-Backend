/**
 * Seed for Rooms (Salones) structure.
 */
const { initDB } = require('./db');

async function seedSalones() {
    console.log('🏛️ Cargando infraestructura física (Sedes y Salones)...');
    const db = await initDB();
    
    try {
        // 1. Sedes
        const sedes = ['Sede Principal', 'Sede Norte', 'Sede Sur'];
        for (const s of sedes) {
            db.prepare('INSERT OR IGNORE INTO sedes (nombre) VALUES (?)').run(s);
        }
        
        const sedeId = db.prepare('SELECT id FROM sedes WHERE nombre = "Sede Principal"').get().id;

        // 2. Bloques
        const bloques = ['Bloque A', 'Bloque B', 'Bloque C', 'Laboratorios'];
        for (const b of bloques) {
            db.prepare('INSERT OR IGNORE INTO bloques (sede_id, nombre) VALUES (?, ?)').run(sedeId, b);
        }

        const bloqueA = db.prepare('SELECT id FROM bloques WHERE nombre = "Bloque A"').get().id;
        const bloqueB = db.prepare('SELECT id FROM bloques WHERE nombre = "Bloque B"').get().id;

        // 3. Salones
        const salonesA = ['A-101', 'A-102', 'A-201', 'A-202'];
        for (const s of salonesA) {
            db.prepare('INSERT OR IGNORE INTO salones (bloque_id, nombre, tipo) VALUES (?, ?, "aula")').run(bloqueA, s);
        }

        const salonesB = ['B-101', 'B-102', 'Sistemas 1', 'Sistemas 2'];
        for (const s of salonesB) {
            db.prepare('INSERT OR IGNORE INTO salones (bloque_id, nombre, tipo) VALUES (?, ?, ?)')
                .run(bloqueB, s, s.includes('Sistemas') ? 'laboratorio' : 'aula');
        }

        db.save();
        console.log('✅ Infraestructura física cargada correctamente.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

seedSalones();
