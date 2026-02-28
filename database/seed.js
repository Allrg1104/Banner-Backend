require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { getDB, initDB } = require('./db');

const SALT_ROUNDS = 10;

function hash(pwd) {
  return bcrypt.hashSync(pwd, SALT_ROUNDS);
}

async function seed() {
  await initDB();
  const db = getDB();

  console.log('🌱 Iniciando seed de datos...');

  // ─── PERÍODOS ────────────────────────────────────────────────────────────────
  db.prepare(`DELETE FROM audit_log`).run();
  db.prepare(`DELETE FROM risk_scores`).run();
  db.prepare(`DELETE FROM password_resets`).run();
  db.prepare(`DELETE FROM pagos`).run();
  db.prepare(`DELETE FROM facturas`).run();
  db.prepare(`DELETE FROM solicitudes`).run();
  db.prepare(`DELETE FROM asistencia`).run();
  db.prepare(`DELETE FROM calificaciones`).run();
  db.prepare(`DELETE FROM matriculas`).run();
  db.prepare(`DELETE FROM cursos`).run();
  db.prepare(`DELETE FROM materias`).run();
  db.prepare(`DELETE FROM estudiantes`).run();
  db.prepare(`DELETE FROM docentes`).run();
  db.prepare(`DELETE FROM periodos`).run();
  db.prepare(`DELETE FROM programas`).run();
  db.prepare(`DELETE FROM personas`).run();

  // Reset autoincrement
  db.prepare(`DELETE FROM sqlite_sequence`).run();

  // ─── PERSONAS ────────────────────────────────────────────────────────────────
  const personas = [
    // Estudiantes
    {
      nombres: 'Santiago',
      apellidos: 'Espinosa Ruiz',
      email: 'santiago.espinosa01@unicatolica.edu.co',
      username: 'santiago.espinosa01',
      password: hash('Temp2024!'),
      rol: 'estudiante',
      documento: '1090123456',
      metadata: JSON.stringify({
        direccion: 'CRA 94A 2 41, Cali, Valle 76001',
        telefono: '3012117114',
        estado_civil: 'Soltero(a)',
        sexo: 'Masculino',
        fecha_nacimiento: '2004-05-07',
        familiares: [
          { nombre: 'JANETH ORTIZ', relacion: 'Madre/Acudiente', telefono: '317 4169964' },
          { nombre: 'DEYSON FERNANDO ESPINOSA', relacion: 'Padre/Acudiente', telefono: '311 7246085' }
        ]
      })
    },
    { nombres: 'Valentina', apellidos: 'García López', email: 'valentina.garcia02@unicatolica.edu.co', username: 'valentina.garcia02', password: hash('Temp2024!'), rol: 'estudiante', documento: '1092345678' },
    { nombres: 'Juan Pablo', apellidos: 'Martínez Cruz', email: 'juan.martinez03@unicatolica.edu.co', username: 'juan.martinez03', password: hash('Temp2024!'), rol: 'estudiante', documento: '1094567890' },
    { nombres: 'Daniela', apellidos: 'Rodríguez Mora', email: 'daniela.rodriguez04@unicatolica.edu.co', username: 'daniela.rodriguez04', password: hash('Temp2024!'), rol: 'estudiante', documento: '1096789012', must_change_password: 0 },
    { nombres: 'Carlos', apellidos: 'Herrera Blanco', email: 'carlos.herrera05@unicatolica.edu.co', username: 'carlos.herrera05', password: hash('Temp2024!'), rol: 'estudiante', documento: '1098901234' },
    // Docentes
    { nombres: 'Prof. Andrea', apellidos: 'Sánchez Vega', email: 'andrea.sanchez@unicatolica.edu.co', username: 'andrea.sanchez', password: hash('Docente2024!'), rol: 'docente', documento: '52000001', must_change_password: 0 },
    { nombres: 'Prof. Ricardo', apellidos: 'Mendoza Pinto', email: 'ricardo.mendoza@unicatolica.edu.co', username: 'ricardo.mendoza', password: hash('Docente2024!'), rol: 'docente', documento: '79000002', must_change_password: 0 },
    // Director
    { nombres: 'Dr. Hernando', apellidos: 'Castillo Ríos', email: 'hernando.castillo@unicatolica.edu.co', username: 'hernando.castillo', password: hash('Director2024!'), rol: 'director', documento: '19000003', must_change_password: 0 },
    // Decano
    { nombres: 'Dra. Patricia', apellidos: 'Vargas Orozco', email: 'patricia.vargas@unicatolica.edu.co', username: 'patricia.vargas', password: hash('Decano2024!'), rol: 'decano', documento: '41000004', must_change_password: 0 },
    // Registro Académico
    { nombres: 'Martha', apellidos: 'Jiménez Castro', email: 'martha.jimenez@unicatolica.edu.co', username: 'martha.jimenez', password: hash('Registro2024!'), rol: 'registro', documento: '52000005', must_change_password: 0 },
    // Financiero
    { nombres: 'Luis', apellidos: 'Pedraza Suárez', email: 'luis.pedraza@unicatolica.edu.co', username: 'luis.pedraza', password: hash('Financiero2024!'), rol: 'financiero', documento: '79000006', must_change_password: 0 },
    // Admin TI
    { nombres: 'Admin', apellidos: 'Sistema TI', email: 'admin@unicatolica.edu.co', username: 'admin.ti', password: hash('Admin2024!'), rol: 'admin', documento: '00000001', must_change_password: 0 },
  ];

  const insertPersona = db.prepare(`
    INSERT INTO personas (nombres,apellidos,email,username,password_hash,rol,documento,must_change_password,metadata)
    VALUES (@nombres,@apellidos,@email,@username,@password,@rol,@documento,@must_change_password,@metadata)
  `);

  const insertMany = db.transaction((rows) => {
    for (const p of rows) {
      if (p.must_change_password === undefined) p.must_change_password = 1;
      if (p.metadata === undefined) p.metadata = '{}';
      insertPersona.run(p);
    }
  });
  insertMany(personas);

  // ─── PROGRAMAS ───────────────────────────────────────────────────────────────
  db.prepare(`INSERT INTO programas(nombre,facultad,nivel,creditos_totales,director_id) VALUES
    ('Ingeniería de Sistemas','Facultad de Ingeniería','pregrado',160,8),
    ('Administración de Empresas','Facultad de Ciencias Económicas','pregrado',148,8),
    ('Contaduría Pública','Facultad de Ciencias Contables','pregrado',152,8)
  `).run();

  // ─── PERÍODO ACTIVO ───────────────────────────────────────────────────────────
  db.prepare(`INSERT INTO periodos(nombre,fecha_inicio,fecha_fin,activo) VALUES
    ('2025-1','2025-01-20','2025-06-15',0),
    ('2025-2','2025-07-07','2025-11-28',1)
  `).run();

  // ─── MATERIAS ────────────────────────────────────────────────────────────────
  db.prepare(`INSERT INTO materias(nombre,codigo,creditos,programa_id,semestre) VALUES
    ('Cálculo Diferencial','CALC101',4,1,1),
    ('Fundamentos de Programación','PROG101',4,1,1),
    ('Álgebra Lineal','ALGLIN',3,1,2),
    ('Estructuras de Datos','EDAT201',4,1,3),
    ('Base de Datos I','BD201',4,1,4),
    ('Contabilidad General','CONT101',4,2,1),
    ('Microeconomía','MICRO101',3,2,2)
  `).run();

  // ─── CURSOS (periodo 2, activo) ────────────────────────────────────────────
  db.prepare(`INSERT INTO cursos(materia_id,docente_id,periodo_id,salon,cupo,horario) VALUES
    (1,6,2,'A-201',30,'Lun-Mié 8:00-10:00'),
    (2,6,2,'B-105',30,'Mar-Jue 10:00-12:00'),
    (3,7,2,'A-301',25,'Vie 8:00-12:00'),
    (4,7,2,'C-202',25,'Lun-Mié 14:00-16:00'),
    (5,6,2,'Lab-1',20,'Mar-Jue 8:00-10:00')
  `).run();

  // ─── DOCENTES ────────────────────────────────────────────────────────────────
  db.prepare(`INSERT INTO docentes(persona_id,departamento,titulo,dedicacion) VALUES
    (6,'Matemáticas','Magíster en Matemáticas Aplicadas','tiempo_completo'),
    (7,'Sistemas','Doctor en Ciencias de la Computación','tiempo_completo')
  `).run();

  // ─── ESTUDIANTES ─────────────────────────────────────────────────────────────
  db.prepare(`INSERT INTO estudiantes(persona_id,programa_id,codigo,semestre_actual,promedio_acumulado) VALUES
    (1,1,'202510001',3,3.8),
    (2,1,'202510002',3,2.7),
    (3,2,'202520001',2,4.1),
    (4,1,'202510003',5,3.5),
    (5,3,'202530001',1,2.4)
  `).run();

  // ─── MATRÍCULAS ──────────────────────────────────────────────────────────────
  const matriculas = [
    // Santiago (id=1) - riesgo medio
    { est: 1, curso: 1 }, { est: 1, curso: 2 }, { est: 1, curso: 3 },
    // Valentina (id=2) - riesgo alto
    { est: 2, curso: 1 }, { est: 2, curso: 4 },
    // Juan Pablo (id=3)
    { est: 3, curso: 2 }, { est: 3, curso: 3 },
    // Daniela (id=4)
    { est: 4, curso: 4 }, { est: 4, curso: 5 },
    // Carlos (id=5) - riesgo crítico
    { est: 5, curso: 1 }, { est: 5, curso: 2 },
  ];
  const insMatricula = db.prepare(`INSERT INTO matriculas(estudiante_id,curso_id) VALUES (@est,@curso)`);
  db.transaction(() => matriculas.forEach(m => insMatricula.run(m)))();

  // ─── CALIFICACIONES ───────────────────────────────────────────────────────────
  const grades = [
    // Santiago mat1 (Cálculo)
    { mat: 1, comp: 'Parcial 1', pct: 30, val: 3.5 }, { mat: 1, comp: 'Parcial 2', pct: 30, val: 3.7 }, { mat: 1, comp: 'Trabajo', pct: 20, val: 4.0 }, { mat: 1, comp: 'Final', pct: 20, val: null },
    // Santiago mat2 (Prog)
    { mat: 2, comp: 'Parcial 1', pct: 30, val: 4.0 }, { mat: 2, comp: 'Parcial 2', pct: 30, val: 3.8 }, { mat: 2, comp: 'Proyecto', pct: 40, val: null },
    // Santiago mat3 (Álgebra)
    { mat: 3, comp: 'Parcial 1', pct: 40, val: 3.2 }, { mat: 3, comp: 'Parcial 2', pct: 40, val: null }, { mat: 3, comp: 'Quiz', pct: 20, val: 3.5 },
    // Valentina mat4 (Cálculo)
    { mat: 4, comp: 'Parcial 1', pct: 30, val: 2.5 }, { mat: 4, comp: 'Parcial 2', pct: 30, val: 2.8 }, { mat: 4, comp: 'Trabajo', pct: 40, val: null },
    // Valentina mat5 (Estructuras)
    { mat: 5, comp: 'Parcial 1', pct: 40, val: 2.0 }, { mat: 5, comp: 'Taller', pct: 20, val: 2.5 }, { mat: 5, comp: 'Final', pct: 40, val: null },
    // Juan Pablo
    { mat: 6, comp: 'Parcial 1', pct: 50, val: 4.5 }, { mat: 6, comp: 'Final', pct: 50, val: null },
    { mat: 7, comp: 'Parcial 1', pct: 50, val: 4.2 }, { mat: 7, comp: 'Final', pct: 50, val: null },
    // Daniela
    { mat: 8, comp: 'Parcial 1', pct: 40, val: 3.8 }, { mat: 8, comp: 'Parcial 2', pct: 40, val: 3.6 }, { mat: 8, comp: 'Quiz', pct: 20, val: 4.0 },
    { mat: 9, comp: 'Parcial 1', pct: 50, val: 3.9 }, { mat: 9, comp: 'Final', pct: 50, val: null },
    // Carlos - riesgo crítico
    { mat: 10, comp: 'Parcial 1', pct: 30, val: 1.8 }, { mat: 10, comp: 'Parcial 2', pct: 30, val: 2.1 }, { mat: 10, comp: 'Trabajo', pct: 40, val: null },
    { mat: 11, comp: 'Parcial 1', pct: 30, val: 2.2 }, { mat: 11, comp: 'Taller', pct: 30, val: 1.9 }, { mat: 11, comp: 'Final', pct: 40, val: null },
  ];
  const insGrade = db.prepare(`INSERT INTO calificaciones(matricula_id,componente,porcentaje,valor) VALUES(@mat,@comp,@pct,@val)`);
  db.transaction(() => grades.forEach(g => insGrade.run(g)))();

  // ─── ASISTENCIA ───────────────────────────────────────────────────────────────
  const fechas = ['2025-07-14', '2025-07-16', '2025-07-21', '2025-07-23', '2025-07-28', '2025-07-30',
    '2025-08-04', '2025-08-06', '2025-08-11', '2025-08-13', '2025-08-18', '2025-08-20'];

  const tipos = (presente, just, nojust) => {
    const arr = [];
    for (let i = 0; i < presente; i++) arr.push('presente');
    for (let i = 0; i < just; i++) arr.push('ausente_justificada');
    for (let i = 0; i < nojust; i++) arr.push('ausente_no_justificada');
    // shuffle simple
    return arr.sort(() => 0.5 - Math.random());
  };

  // Santiago mat1: 10p, 1j, 1nj
  // Valentina mat4: 8p, 2j, 2nj
  // Carlos mat10: 6p, 2j, 4nj  ← >3 no justificadas = CRÍTICO
  const asistPatterns = [
    { mat: 1, tipos: tipos(10, 1, 1) }, // Santiago - Cálculo normal
    { mat: 2, tipos: tipos(11, 1, 0) }, // Santiago - Prog bien
    { mat: 3, tipos: tipos(9, 2, 1) },  // Santiago - Álgebra
    { mat: 4, tipos: tipos(8, 2, 2) },  // Valentina - Cálculo riesgo medio
    { mat: 5, tipos: tipos(7, 3, 2) },  // Valentina - Estructuras
    { mat: 6, tipos: tipos(12, 0, 0) }, // Juan Pablo
    { mat: 7, tipos: tipos(11, 1, 0) },
    { mat: 8, tipos: tipos(12, 0, 0) }, // Daniela
    { mat: 9, tipos: tipos(11, 0, 1) },
    { mat: 10, tipos: tipos(6, 2, 4) }, // Carlos - CRÍTICO >3 nojust
    { mat: 11, tipos: tipos(7, 1, 4) }, // Carlos - también crítico
  ];

  const insAsis = db.prepare(`INSERT INTO asistencia(matricula_id,fecha,tipo) VALUES(@mat,@fecha,@tipo)`);
  db.transaction(() => {
    asistPatterns.forEach(p => {
      fechas.slice(0, p.tipos.length).forEach((f, i) => {
        insAsis.run({ mat: p.mat, fecha: f, tipo: p.tipos[i] });
      });
    });
  })();

  // ─── FACTURAS ─────────────────────────────────────────────────────────────────
  const facturasData = [
    { est: 1, per: 2, concepto: 'Matrícula 2025-2', valor: 2850000, vence: '2025-07-05', estado: 'pagada', num: 'FACT-2025-0001' },
    { est: 2, per: 2, concepto: 'Matrícula 2025-2', valor: 2850000, vence: '2025-07-05', estado: 'retencion', num: 'FACT-2025-0002' },
    { est: 3, per: 2, concepto: 'Matrícula 2025-2', valor: 2850000, vence: '2025-07-05', estado: 'pagada', num: 'FACT-2025-0003' },
    { est: 4, per: 2, concepto: 'Matrícula 2025-2', valor: 2850000, vence: '2025-07-05', estado: 'pendiente', num: 'FACT-2025-0004' },
    { est: 5, per: 2, concepto: 'Matrícula 2025-2', valor: 2850000, vence: '2025-07-05', estado: 'vencida', num: 'FACT-2025-0005' },
  ];
  const insFact = db.prepare(`INSERT INTO facturas(estudiante_id,periodo_id,concepto,valor,fecha_vencimiento,estado,numero_factura) VALUES(@est,@per,@concepto,@valor,@vence,@estado,@num)`);
  db.transaction(() => facturasData.forEach(f => insFact.run(f)))();

  // Pago de Santiago (factura 1)
  db.prepare(`INSERT INTO pagos(factura_id,valor,metodo,referencia) VALUES(1,2850000,'virtual','REF-VRT-001')`).run();

  // ─── SOLICITUDES ──────────────────────────────────────────────────────────────
  db.prepare(`INSERT INTO solicitudes(estudiante_id,tipo,estado,descripcion) VALUES
    (1,'Certificado de notas','aprobada','Solicitud certificado para beca'),
    (2,'Justificación de inasistencias','en_proceso','Incapacidad médica semana del 25 de agosto'),
    (3,'Retiro de materia','pendiente','Deseo retirar Álgebra Lineal por carga académica'),
    (5,'Paz y salvo','pendiente','Necesito paz y salvo financiero')
  `).run();

  console.log('✅ Seed completado. Credenciales de prueba:');
  console.log('   Estudiante:   santiago.espinosa01 / Temp2024!  (must_change=true)');
  console.log('   Docente:      andrea.sanchez / Docente2024!');
  console.log('   Director:     hernando.castillo / Director2024!');
  console.log('   Decano:       patricia.vargas / Decano2024!');
  console.log('   Registro:     martha.jimenez / Registro2024!');
  console.log('   Financiero:   luis.pedraza / Financiero2024!');
  console.log('   Admin TI:     admin.ti / Admin2024!');
}

seed().catch(console.error);
