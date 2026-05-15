const { initDB } = require('./database/db.js');

const structure = {
    "MELENDEZ": {
        "BLOQUE A": ["A 100", "A 101", "A 102", "A 103", "A 104", "A 105", "A 106", "A 107", "A 108", "A 109"],
        "BLOQUE B": ["B 100", "B 101", "B 102", "B 103", "B 104", "B 105", "B 106", "B 107", "B 108", "B 109"],
        "BLOQUE C": ["AUDITORIO 1"],
        "BLOQUE D": ["SALA 9", "SALA 10", "SALA 11", "SALA INGLES"],
        "BLOQUE E": ["E 100", "E 101", "E 102", "E 103", "E 104", "E 105"],
        "BLOQUE F": ["F 100", "F 101", "F 102", "F 103", "F 104"],
        "BLOQUE G": ["G 100", "G 101", "G 102", "G 103", "G 104", "G 105"],
        "BLOQUE H": ["SALA 1", "SALA 2", "SALA 3", "SALA 4", "SALA 5", "SALA 6", "SALA 7", "SALA 8"],
        "BLOQUE I": ["I 100", "I 101", "I 103"],
        "BLOQUE J": ["J 100", "J 101", "J 102", "J 103", "J 104", "J 105"],
        "BLOQUE K": ["K 100", "K 101", "K 102", "K 103", "K 104", "K 105", "K 106"]
    },
    "PANCE": {
        "BLOQUE A": ["A 100", "A 101", "A 102", "A 103", "A 200", "A 201", "A 202", "A 203", "A 204", "A 205"],
        "BLOQUE B": ["B 100", "B 101", "B 102", "B 103", "B 104", "B 105", "AUDIOVISUALES 1", "AUDIOVISUALES 2", "SALA DE SISTEMAS 1", "SALA DE SISTEMAS 2", "SALA DE SISTEMAS 3", "AUDITORIO 1", "AUDITORIO 2"],
        "BLOQUE E": ["E 100", "E 101", "E 102", "E 103", "E 104", "E 105"],
        "BLOQUE F": ["F 100", "F 101"]
    }
};

function getTipoSalon(nombre) {
    const n = nombre.toUpperCase();
    if (n.includes('SISTEMA') || n.includes('SALA')) return 'laboratorio';
    if (n.includes('AUDIOVISUAL')) return 'audiovisual';
    if (n.includes('AUDITORIO')) return 'auditorio';
    return 'aula';
}

async function populateRealData() {
    console.log('🚀 Iniciando poblamiento real de infraestructura académica...');
    const db = await initDB();
    
    try {
        console.log('🧹 Limpiando tablas de infraestructura...');
        // Primero limpiar cursos para evitar foreign key constraints si hubieran
        db._db.run('UPDATE cursos SET salon_id = NULL');
        
        db._db.run('DELETE FROM salones');
        db._db.run('DELETE FROM bloques');
        db._db.run('DELETE FROM sedes');
        
        let sedesCount = 0;
        let bloquesCount = 0;
        let salonesCount = 0;

        const insertSede = db.prepare('INSERT INTO sedes (nombre) VALUES (?)');
        const insertBloque = db.prepare('INSERT INTO bloques (sede_id, nombre) VALUES (?, ?)');
        const insertSalon = db.prepare('INSERT INTO salones (bloque_id, nombre, tipo) VALUES (?, ?, ?)');

        for (const [sedeNombre, bloques] of Object.entries(structure)) {
            const resultSede = insertSede.run(sedeNombre);
            const sedeId = resultSede.lastInsertRowid;
            sedesCount++;
            console.log(`📍 Insertada Sede: ${sedeNombre} (ID: ${sedeId})`);

            for (const [bloqueNombre, salones] of Object.entries(bloques)) {
                const resultBloque = insertBloque.run(sedeId, bloqueNombre);
                const bloqueId = resultBloque.lastInsertRowid;
                bloquesCount++;

                for (const salonNombre of salones) {
                    const tipo = getTipoSalon(salonNombre);
                    insertSalon.run(bloqueId, salonNombre, tipo);
                    salonesCount++;
                }
            }
        }

        console.log('💾 Guardando cambios en la base de datos...');
        db.save();

        console.log('\n✅ POBLAMIENTO REAL COMPLETADO CON ÉXITO');
        console.log(`📊 Resumen Total: ${sedesCount} Sedes, ${bloquesCount} Bloques, ${salonesCount} Salones.`);
        console.log('----------------------------------------------------------');
        console.log('Ya puedes revisar los datos en la plataforma.');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL POBLAMIENTO:', error.message);
        process.exit(1);
    }
}

populateRealData();
