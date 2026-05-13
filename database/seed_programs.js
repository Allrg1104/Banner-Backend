const { getDB, initDB } = require('./db');

async function seedPrograms() {
    console.log('⏳ Inicializando base de datos para programas...');
    await initDB();
    const db = getDB();

    try {
        console.log('📦 Insertando Programas Académicos...');
        
        const programs = [
            { id: 1, nombre: 'Ingeniería de Sistemas', facultad: 'Ingeniería' },
            { id: 2, nombre: 'Ingeniería Industrial', facultad: 'Ingeniería' },
            { id: 3, nombre: 'Psicología', facultad: 'Ciencias Sociales' },
            { id: 4, nombre: 'Administración de Empresas', facultad: 'Ciencias Económicas' },
            { id: 5, nombre: 'Contaduría', facultad: 'Ciencias Económicas' }
        ];

        const insertProgram = db.prepare('INSERT OR IGNORE INTO programas (id, nombre, facultad, nivel, creditos_totales, activo) VALUES (?, ?, ?, "pregrado", 160, 1)');
        
        db.transaction(() => {
            for (const p of programs) {
                insertProgram.run(p.id, p.nombre, p.facultad);
            }
        })();

        console.log('✅ Programas insertados con éxito.');

        // 2. Asignar Alejandro y Santiago a Ingeniería de Sistemas (ID 1)
        console.log('🎓 Asignando estudiantes específicos a Ingeniería de Sistemas...');
        
        // Find Alejandro by student ID
        const alejandro = db.prepare('SELECT id FROM estudiantes WHERE codigo = ?').get('000400005');
        if (alejandro) {
            db.prepare('UPDATE estudiantes SET programa_id = 1 WHERE id = ?').run(alejandro.id);
            console.log('   -> Alejandro (000400005) asignado a Sistemas.');
        } else {
            console.log('   -> ⚠️ Alejandro (000400005) no encontrado en la BD.');
        }

        // Find Santiago by username
        const santiago = db.prepare('SELECT e.id FROM estudiantes e JOIN personas p ON e.persona_id = p.id WHERE p.username = ?').get('santiago.espinosa01');
        if (santiago) {
            db.prepare('UPDATE estudiantes SET programa_id = 1 WHERE id = ?').run(santiago.id);
            console.log('   -> Santiago (santiago.espinosa01) asignado a Sistemas.');
        } else {
            console.log('   -> ⚠️ Santiago no encontrado en la BD.');
        }

        // 3. Asignar el resto de los estudiantes a un programa por defecto (ej. Sistemas o aleatorio)
        console.log('🔄 Asignando programa por defecto a los demás estudiantes...');
        db.prepare('UPDATE estudiantes SET programa_id = 1 WHERE programa_id IS NULL').run();

        db.save();
        console.log('🚀 Proceso completado exitosamente.');

    } catch (err) {
        console.error('❌ Error ejecutando el seeder de programas:', err);
    }
}

seedPrograms();
