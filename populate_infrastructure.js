/**
 * Script de Poblamiento de Infraestructura Académica
 * Sedes: PANCE, MELENDEZ
 * Bloques: A, B, C / 1, 2, 3
 * Salones: 5 por bloque (Total 30)
 */

const { initDB } = require('./database/db.js');

async function populate() {
    console.log('🚀 Iniciando poblamiento de infraestructura...');
    const db = await initDB();
    
    try {
        // 1. Limpieza de datos previos (opcional, para evitar duplicados)
        console.log('🧹 Limpiando tablas de infraestructura...');
        db._db.run('DELETE FROM salones');
        db._db.run('DELETE FROM bloques');
        db._db.run('DELETE FROM sedes');
        
        // 2. Insertar Sedes
        console.log('📍 Insertando Sedes...');
        db.prepare('INSERT INTO sedes (id, nombre) VALUES (?, ?)').run(1, 'PANCE');
        db.prepare('INSERT INTO sedes (id, nombre) VALUES (?, ?)').run(2, 'MELENDEZ');

        // 3. Insertar Bloques
        console.log('🏢 Insertando Bloques...');
        const bloques = [
            // Sede Pance (ID: 1)
            { id: 1, sede_id: 1, nombre: 'BLOQUE A' },
            { id: 2, sede_id: 1, nombre: 'BLOQUE B' },
            { id: 3, sede_id: 1, nombre: 'BLOQUE C' },
            // Sede Meléndez (ID: 2)
            { id: 4, sede_id: 2, nombre: 'BLOQUE 1' },
            { id: 5, sede_id: 2, nombre: 'BLOQUE 2' },
            { id: 6, sede_id: 2, nombre: 'BLOQUE 3' }
        ];

        const insBloque = db.prepare('INSERT INTO bloques (id, sede_id, nombre) VALUES (?, ?, ?)');
        bloques.forEach(b => insBloque.run(b.id, b.sede_id, b.nombre));

        // 4. Insertar Salones (5 por cada bloque)
        console.log('🚪 Insertando Salones (30 en total)...');
        const insSalon = db.prepare('INSERT INTO salones (bloque_id, nombre, tipo) VALUES (?, ?, ?)');
        
        for (const b of bloques) {
            for (let i = 1; i <= 5; i++) {
                const salonNombre = `SALON ${b.id}0${i}`;
                insSalon.run(b.id, salonNombre, 'AULA');
            }
        }

        // 5. Vincular Cursos Existentes (Opcional, para visualización inmediata)
        console.log('🔗 Vinculando cursos activos a salones...');
        const salones = db.prepare('SELECT id FROM salones').all();
        const cursos = db.prepare('SELECT id FROM cursos WHERE estado = "activo"').all();
        
        if (cursos.length > 0) {
            cursos.forEach((curso, index) => {
                const salonId = salones[index % salones.length].id;
                const horarioPlaceholder = ['Lun-Mie 07:30-09:30', 'Mar-Jue 09:30-11:30', 'Vie 07:30-11:30'][index % 3];
                db.prepare('UPDATE cursos SET salon_id = ?, horario = ? WHERE id = ?')
                  .run(salonId, horarioPlaceholder, curso.id);
            });
        }

        // 6. Guardar Cambios
        console.log('💾 Guardando cambios en academic.db...');
        db.save();
        
        const totalSedes = db.prepare('SELECT count(*) as c FROM sedes').get().c;
        const totalBloques = db.prepare('SELECT count(*) as c FROM bloques').get().c;
        const totalSalones = db.prepare('SELECT count(*) as c FROM salones').get().c;

        console.log('\n✅ POBLAMIENTO COMPLETADO CON ÉXITO');
        console.log(`📊 Resumen: ${totalSedes} Sedes, ${totalBloques} Bloques, ${totalSalones} Salones.`);
        console.log('----------------------------------------------------------');
        console.log('Ya puedes iniciar el servidor con "npm start"');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL POBLAMIENTO:', error.message);
        process.exit(1);
    }
}

populate();
