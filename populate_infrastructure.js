/**
 * Script de Poblamiento de Infraestructura Académica
 */
const { initDB } = require('./database/db.js');

async function populate() {
    console.log('🚀 Iniciando poblamiento en el servidor...');
    const db = await initDB();
    try {
        db._db.run('DELETE FROM salones');
        db._db.run('DELETE FROM bloques');
        db._db.run('DELETE FROM sedes');

        db.prepare('INSERT INTO sedes (id, nombre) VALUES (?, ?)').run(1, 'PANCE');
        db.prepare('INSERT INTO sedes (id, nombre) VALUES (?, ?)').run(2, 'MELENDEZ');

        const bloques = [
            { id: 1, sede_id: 1, nombre: 'BLOQUE A' },
            { id: 2, sede_id: 1, nombre: 'BLOQUE B' },
            { id: 3, sede_id: 1, nombre: 'BLOQUE C' },
            { id: 4, sede_id: 2, nombre: 'BLOQUE 1' },
            { id: 5, sede_id: 2, nombre: 'BLOQUE 2' },
            { id: 6, sede_id: 2, nombre: 'BLOQUE 3' }
        ];
        const insBloque = db.prepare('INSERT INTO bloques (id, sede_id, nombre) VALUES (?, ?, ?)');
        bloques.forEach(b => insBloque.run(b.id, b.sede_id, b.nombre));

        const insSalon = db.prepare('INSERT INTO salones (bloque_id, nombre, tipo) VALUES (?, ?, ?)');
        for (const b of bloques) {
            for (let i = 1; i <= 5; i++) {
                insSalon.run(b.id, `SALON ${b.id}0${i}`, 'AULA');
            }
        }

        db.save();
        console.log('\n✅ POBLAMIENTO EN SERVIDOR COMPLETADO');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        process.exit(1);
    }
}
populate();
