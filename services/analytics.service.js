const { getDB } = require('../database/db');

/**
 * Servicio de Analítica y KPIs
 */

function getStudentDashboardMetrics(estudianteId, periodId = null) {
  const db = getDB();

  // Resumen académico (Global)
  const resumen = db.prepare(`
    SELECT e.promedio_acumulado, e.semestre_actual, e.tiene_retencion, prog.nombre as programa
    FROM estudiantes e
    JOIN programas prog ON e.programa_id = prog.id
    WHERE e.persona_id = ?
  `).get(estudianteId) || { promedio_acumulado: 0, semestre_actual: 1, tiene_retencion: 0, programa: 'N/A' };

  // Asistencia general
  const asistencia = db.prepare(`
    SELECT tipo, COUNT(*) as cantidad
    FROM asistencia a
    JOIN matriculas m ON a.matricula_id = m.id
    WHERE m.estudiante_id = ?
    GROUP BY tipo
  `).all(estudianteId);

  // Materias inscritas en periodo seleccionado (o activo por defecto)
  let periodQuery = 'p.activo = 1';
  const params = [estudianteId];

  if (periodId) {
    periodQuery = 'p.id = ?';
    params.push(periodId);
  }

  const matriculas = db.prepare(`
    SELECT 
        m.id as matricula_id, 
        mat.nombre as materia, 
        mat.codigo,
        c.nrc, 
        p_doc.nombres || ' ' || p_doc.apellidos as docente,
        COALESCE((SELECT AVG(valor) FROM calificaciones WHERE matricula_id = m.id AND valor IS NOT NULL), 0) as promedio,
        COALESCE((SELECT (COUNT(CASE WHEN tipo = 'presente' THEN 1 END) * 100.0 / COUNT(*)) FROM asistencia WHERE matricula_id = m.id), 100) as asistencia_porcentaje
    FROM matriculas m
    JOIN cursos c ON m.curso_id = c.id
    JOIN materias mat ON c.materia_id = mat.id
    JOIN personas p_doc ON c.docente_id = p_doc.id
    JOIN periodos p ON c.periodo_id = p.id
    WHERE m.estudiante_id = ? AND ${periodQuery}
  `).all(...params);

  // Adapt to frontend expectations
  const matriculasMapped = matriculas.map(m => ({
    ...m,
    asistencia: { porcentaje: Math.round(m.asistencia_porcentaje) }
  }));

  // Calculate the average for the period
  const promediosMateria = matriculasMapped.map(m => m.promedio).filter(p => p > 0);
  const promedio_periodo = promediosMateria.length > 0 
    ? promediosMateria.reduce((a, b) => a + b, 0) / promediosMateria.length 
    : 0;

  resumen.promedio_periodo = promedio_periodo;

  return { resumen, asistencia, matriculas: matriculasMapped };
}

function getTeacherDashboardMetrics(docenteId) {
  const db = getDB();

  // Cursos asignados en periodo activo
  const cursos = db.prepare(`
    SELECT c.id, m.nombre, m.codigo, c.salon, c.horario,
           (SELECT COUNT(*) FROM matriculas WHERE curso_id = c.id) as total_estudiantes
    FROM cursos c
    JOIN materias m ON c.materia_id = m.id
    JOIN periodos p ON c.periodo_id = p.id
    WHERE c.docente_id = ? AND p.activo = 1
  `).all(docenteId);

  return { cursos };
}

function getDirectorKPIs() {
  const db = getDB();

  // Tasa de deserción (simulada por estados de estudiante)
  const estados = db.prepare(`
    SELECT estado, COUNT(*) as cantidad
    FROM estudiantes
    GROUP BY estado
  `).all();

  // Rendimiento por programa
  const rendimientoPrograma = db.prepare(`
    SELECT p.nombre, AVG(e.promedio_acumulado) as promedio
    FROM programas p
    JOIN estudiantes e ON p.id = e.programa_id
    GROUP BY p.id
  `).all();

  // Conteo total
  const totales = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM personas WHERE rol = 'estudiante') as total_estudiantes,
      (SELECT COUNT(*) FROM personas WHERE rol = 'docente') as total_docentes,
      (SELECT COUNT(*) FROM programas) as total_programas
  `).get();

  return { estados, rendimientoPrograma, totales };
}

function getFinancialKPIs() {
  const db = getDB();

  const recaudoPorEstado = db.prepare(`
    SELECT estado, SUM(valor) as total, COUNT(*) as cantidad
    FROM facturas
    GROUP BY estado
  `).all();

  const ingresosMes = db.prepare(`
    SELECT strftime('%Y-%m', fecha) as mes, SUM(valor) as total
    FROM pagos
    GROUP BY mes
    ORDER BY mes DESC
    LIMIT 6
  `).all();

  return { recaudoPorEstado, ingresosMes };
}

module.exports = {
  getStudentDashboardMetrics,
  getTeacherDashboardMetrics,
  getDirectorKPIs,
  getFinancialKPIs
};
