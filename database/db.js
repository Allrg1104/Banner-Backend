const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'academic.db');

let db;

/**
 * sql.js wrapper that mimics better-sqlite3 API
 * so the rest of the codebase needs zero changes.
 */
class DBWrapper {
  constructor(sqliteDb) {
    this._db = sqliteDb;
  }

  prepare(sql) {
    const self = this;
    // Basic support for named parameters (@param)
    const sqlNormalized = sql.replace(/@(\w+)/g, ':$1');

    return {
      run(...args) {
        const stmt = self._db.prepare(sqlNormalized);
        const bindParams = self._formatParams(args);
        stmt.bind(bindParams);
        stmt.run();
        stmt.free();
        return { changes: self._db.getRowsModified(), lastInsertRowid: self._getLastId() };
      },
      get(...args) {
        const stmt = self._db.prepare(sqlNormalized);
        const bindParams = self._formatParams(args);
        stmt.bind(bindParams);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...args) {
        const results = [];
        const stmt = self._db.prepare(sqlNormalized);
        const bindParams = self._formatParams(args);
        stmt.bind(bindParams);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  /** Helper to handle both arrays (positional) and objects (named) */
  _formatParams(args) {
    // If it's a single object (and not null), it might be named parameters
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
      const params = args[0];
      const formatted = {};
      for (const key in params) {
        formatted[':' + key] = params[key];
      }
      return formatted;
    }
    // Otherwise return the array of arguments for positional parameters
    return args;
  }

  transaction(fn) {
    return (...args) => {
      this._db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        this._db.run('COMMIT');
        this.save();
        return result;
      } catch (error) {
        this._db.run('ROLLBACK');
        throw error;
      }
    };
  }

  exec(sql) {
    this._db.run(sql);
  }

  pragma(str) {
    try { this._db.run('PRAGMA ' + str); } catch (e) { /* ignore */ }
  }

  _getLastId() {
    const res = this._db.exec('SELECT last_insert_rowid() as id');
    if (res.length > 0 && res[0].values.length > 0) {
      return res[0].values[0][0];
    }
    return 0;
  }

  /** Persist the database to disk */
  save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Ensure initDB() is called and awaited at application start.');
  }
  return db;
}

async function initDB() {
  if (db) return db;

  const SQL = await initSqlJs();

  // If a database file already exists on disk, load it
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    const sqliteDb = new SQL.Database(fileBuffer);
    db = new DBWrapper(sqliteDb);
  } else {
    const sqliteDb = new SQL.Database();
    db = new DBWrapper(sqliteDb);
  }

  const schema = `
        CREATE TABLE IF NOT EXISTS personas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombres TEXT NOT NULL,
          apellidos TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          rol TEXT NOT NULL CHECK(rol IN ('estudiante','docente','director','decano','registro','financiero','admin')),
          activo INTEGER DEFAULT 1,
          must_change_password INTEGER DEFAULT 1,
          documento TEXT,
          tipo_documento TEXT DEFAULT 'CC',
          telefono TEXT,
          fecha_nacimiento TEXT,
          foto_url TEXT,
          metadata TEXT DEFAULT '{}',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS programas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          facultad TEXT NOT NULL,
          nivel TEXT CHECK(nivel IN ('pregrado','posgrado','especializacion','maestria','doctorado')),
          creditos_totales INTEGER DEFAULT 160,
          director_id INTEGER REFERENCES personas(id),
          activo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS materias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          codigo TEXT UNIQUE NOT NULL,
          creditos INTEGER DEFAULT 3,
          programa_id INTEGER REFERENCES programas(id),
          semestre INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS periodos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          fecha_inicio TEXT NOT NULL,
          fecha_fin TEXT NOT NULL,
          activo INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS estudiantes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id INTEGER UNIQUE REFERENCES personas(id),
          programa_id INTEGER REFERENCES programas(id),
          codigo TEXT UNIQUE NOT NULL,
          semestre_actual INTEGER DEFAULT 1,
          estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','inactivo','graduado','retirado')),
          fecha_ingreso TEXT DEFAULT (date('now')),
          promedio_acumulado REAL DEFAULT 0.0,
          tiene_retencion INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS docentes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id INTEGER UNIQUE REFERENCES personas(id),
          departamento TEXT,
          titulo TEXT,
          dedicacion TEXT DEFAULT 'tiempo_completo' CHECK(dedicacion IN ('tiempo_completo','medio_tiempo','catedra'))
        );

        CREATE TABLE IF NOT EXISTS cursos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          materia_id INTEGER REFERENCES materias(id),
          docente_id INTEGER REFERENCES personas(id),
          periodo_id INTEGER REFERENCES periodos(id),
          salon TEXT,
          cupo INTEGER DEFAULT 30,
          horario TEXT,
          estado TEXT DEFAULT 'activo'
        );

        CREATE TABLE IF NOT EXISTS matriculas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          estudiante_id INTEGER REFERENCES personas(id),
          curso_id INTEGER REFERENCES cursos(id),
          fecha TEXT DEFAULT (date('now')),
          estado TEXT DEFAULT 'activa' CHECK(estado IN ('activa','retirada','perdida','aprobada')),
          UNIQUE(estudiante_id, curso_id)
        );

        CREATE TABLE IF NOT EXISTS calificaciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matricula_id INTEGER REFERENCES matriculas(id),
          componente TEXT NOT NULL,
          porcentaje REAL DEFAULT 100,
          valor REAL CHECK(valor BETWEEN 0 AND 5),
          fecha TEXT DEFAULT (date('now')),
          observacion TEXT
        );

        CREATE TABLE IF NOT EXISTS asistencia (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matricula_id INTEGER REFERENCES matriculas(id),
          fecha TEXT NOT NULL,
          tipo TEXT CHECK(tipo IN ('presente','ausente_justificada','ausente_no_justificada')),
          observacion TEXT
        );

        CREATE TABLE IF NOT EXISTS solicitudes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          estudiante_id INTEGER REFERENCES personas(id),
          tipo TEXT NOT NULL,
          estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_proceso','aprobada','rechazada')),
          descripcion TEXT,
          respuesta TEXT,
          fecha TEXT DEFAULT (datetime('now')),
          atendida_por INTEGER REFERENCES personas(id)
        );

        CREATE TABLE IF NOT EXISTS facturas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          estudiante_id INTEGER REFERENCES personas(id),
          periodo_id INTEGER REFERENCES periodos(id),
          concepto TEXT NOT NULL,
          valor REAL NOT NULL,
          fecha_emision TEXT DEFAULT (date('now')),
          fecha_vencimiento TEXT NOT NULL,
          estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','pagada','vencida','retencion')),
          numero_factura TEXT UNIQUE
        );

        CREATE TABLE IF NOT EXISTS pagos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          factura_id INTEGER REFERENCES facturas(id),
          valor REAL NOT NULL,
          fecha TEXT DEFAULT (datetime('now')),
          metodo TEXT CHECK(metodo IN ('virtual','banco','otro')),
          referencia TEXT UNIQUE,
          estado TEXT DEFAULT 'aprobado',
          datos_pasarela TEXT
        );

        CREATE TABLE IF NOT EXISTS password_resets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES personas(id),
          token TEXT UNIQUE NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES personas(id),
          accion TEXT NOT NULL,
          entidad TEXT,
          entidad_id INTEGER,
          detalles TEXT,
          ip TEXT,
          timestamp TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS risk_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matricula_id INTEGER REFERENCES matriculas(id),
          score REAL NOT NULL,
          nivel TEXT CHECK(nivel IN ('verde','amarillo','rojo','critico')),
          nota_proyectada REAL,
          razon TEXT,
          fecha_calculo TEXT DEFAULT (datetime('now'))
        );
    `;

  const statements = schema.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try { db._db.run(stmt + ';'); } catch (e) { /* ignore existing table errors */ }
  }

  db.save();
  console.log('✅ Base de datos inicializada correctamente');
  return db;
}

// Auto-save periodically
setInterval(() => { if (db) db.save(); }, 30000);

module.exports = { getDB, initDB };
