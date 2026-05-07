const { getDB, initDB } = require('./db');

async function updateSchema() {
    await initDB();
    const db = getDB();

    try {
        console.log('🏗️ Actualizando esquema para soporte de NRC e IDs Institucionales...');

        // 1. Añadir columna NRC a cursos si no existe
        try {
            db.exec('ALTER TABLE cursos ADD COLUMN nrc TEXT UNIQUE;');
            console.log('✅ Columna NRC añadida a la tabla cursos.');
        } catch (e) {
            console.log('ℹ️ La columna NRC ya existe o no se pudo añadir.');
        }

        // 2. Asignar NRCs aleatorios a los cursos existentes para pruebas
        const cursos = db.prepare('SELECT id FROM cursos').all();
        db.transaction(() => {
            cursos.forEach((c, i) => {
                const nrc = (10000 + i).toString();
                db.prepare('UPDATE cursos SET nrc = ? WHERE id = ?').run(nrc, c.id);
            });
        })();
        console.log(`✅ ${cursos.length} cursos actualizados con NRC.`);

        // 3. Asegurar ID Institucional de Santiago y otros
        const santiago = db.prepare('SELECT id FROM personas WHERE username = "santiago.espinosa01"').get();
        if (santiago) {
            db.prepare('UPDATE estudiantes SET codigo = "000405330" WHERE persona_id = ?').run(santiago.id);
            console.log('✅ Santiago actualizado con ID Institucional: 000405330');
        }

        // 4. Asignar IDs institucionales a los demás estudiantes si no tienen el formato 000...
        const ests = db.prepare('SELECT id, persona_id FROM estudiantes').all();
        db.transaction(() => {
            ests.forEach((e, i) => {
                const institutionalId = (400000 + i).toString().padStart(9, '0');
                db.prepare('UPDATE estudiantes SET codigo = ? WHERE id = ?').run(institutionalId, e.id);
            });
        })();

        db.save();
        console.log('🚀 Base de datos lista para importaciones masivas.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

updateSchema();
