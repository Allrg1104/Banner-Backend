const { getDB, initDB } = require('./db');

async function updateSchema() {
    await initDB();
    const db = getDB();

    try {
        console.log('🏗️ Asegurando columna NRC en la tabla cursos...');

        // 1. Intentar añadir la columna NRC
        try {
            db.exec('ALTER TABLE cursos ADD COLUMN nrc TEXT;');
            db.save(); // Guardar inmediatamente para que la columna sea reconocida
            console.log('✅ Columna NRC creada con éxito.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('ℹ️ La columna NRC ya existe, continuando...');
            } else {
                throw e;
            }
        }

        // 2. Asignar NRCs a los cursos
        const cursos = db.prepare('SELECT id FROM cursos').all();
        db.transaction(() => {
            cursos.forEach((c, i) => {
                const nrc = (10000 + i).toString();
                db.prepare('UPDATE cursos SET nrc = ? WHERE id = ?').run(nrc, c.id);
            });
        })();
        console.log(`✅ ${cursos.length} cursos actualizados con NRC.`);

        // 3. IDs Institucionales
        const santiago = db.prepare('SELECT id FROM personas WHERE username = "santiago.espinosa01"').get();
        if (santiago) {
            db.prepare('UPDATE estudiantes SET codigo = "000405330" WHERE persona_id = ?').run(santiago.id);
            console.log('✅ Santiago ID: 000405330');
        }

        const ests = db.prepare('SELECT id FROM estudiantes').all();
        db.transaction(() => {
            ests.forEach((e, i) => {
                const institutionalId = (400000 + i).toString().padStart(9, '0');
                db.prepare('UPDATE estudiantes SET codigo = ? WHERE id = ?').run(institutionalId, e.id);
            });
        })();

        db.save();
        console.log('🚀 Sincronización completada.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error fatal:', e.message);
        process.exit(1);
    }
}

updateSchema();
