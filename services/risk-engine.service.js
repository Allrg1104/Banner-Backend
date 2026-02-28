const { getDB } = require('../database/db');

/**
 * Motor Predictivo de Riesgo Académico
 * Nivel 1: Reglas de negocio institucionales
 * Nivel 2: Regresión lineal simple
 */

function calcularRiesgoMatricula(matriculaId) {
    const db = getDB();

    // Obtener calificaciones con valor
    const califs = db.prepare(`
    SELECT componente, porcentaje, valor FROM calificaciones
    WHERE matricula_id = ? AND valor IS NOT NULL
  `).all(matriculaId);

    // Obtener asistencia
    const asistencia = db.prepare(`
    SELECT tipo, COUNT(*) as total FROM asistencia
    WHERE matricula_id = ? GROUP BY tipo
  `).all(matriculaId);

    const totalClases = db.prepare(`SELECT COUNT(*) as total FROM asistencia WHERE matricula_id=?`).get(matriculaId);

    const asistMap = {};
    asistencia.forEach(a => asistMap[a.tipo] = a.total);

    const ausentes_no_just = asistMap['ausente_no_justificada'] || 0;
    const ausentes_just = asistMap['ausente_justificada'] || 0;
    const presentes = asistMap['presente'] || 0;
    const total_clases = totalClases?.total || 0;

    // ─── NIVEL 1: REGLAS DE NEGOCIO ─────────────────────────────────────────────
    // REGLA 1: >3 inasistencias no justificadas → PIERDE
    if (ausentes_no_just > 3) {
        return {
            score: 100,
            nivel: 'critico',
            nota_proyectada: 0,
            razon: `Pérdida por inasistencias no justificadas: ${ausentes_no_just} (máx 3)`,
            detalle: { ausentes_no_just, ausentes_just, presentes, total_clases }
        };
    }

    // REGLA 2: >5 inasistencias justificadas → PIERDE
    if (ausentes_just > 5) {
        return {
            score: 100,
            nivel: 'critico',
            nota_proyectada: 0,
            razon: `Pérdida por inasistencias justificadas: ${ausentes_just} (máx 5)`,
            detalle: { ausentes_no_just, ausentes_just, presentes, total_clases }
        };
    }

    // ─── NIVEL 2: REGRESIÓN LINEAL ──────────────────────────────────────────────
    let promedio_actual = 0;
    let peso_total = 0;

    califs.forEach(c => {
        promedio_actual += c.valor * (c.porcentaje / 100);
        peso_total += c.porcentaje / 100;
    });

    // Promedio ponderado de componentes evaluados hasta ahora
    if (peso_total > 0) promedio_actual = promedio_actual / peso_total;

    const pct_asistencia = total_clases > 0 ? (presentes / total_clases) * 100 : 100;

    // Fórmula de regresión:
    // nota_proyectada = β₀ + β₁·promedio_actual + β₂·(pct_asistencia/20)
    const β0 = 0.5, β1 = 0.7, β2 = 0.3;
    let nota_proyectada = β0 + β1 * promedio_actual + β2 * (pct_asistencia / 20);
    nota_proyectada = Math.max(0, Math.min(5, nota_proyectada));

    // Score de riesgo (0–100, mayor = más riesgo)
    let score = 100 - (nota_proyectada / 5 * 50) - (pct_asistencia / 100 * 50);
    score = Math.max(0, Math.min(100, score));

    // REGLA 3: Promedio actual < 3.0 → ROJO
    // REGLA 4: Promedio 3.0–3.5 → AMARILLO
    // REGLA 5: Promedio > 3.5 → VERDE
    let nivel;
    let razon;
    if (score > 65 || promedio_actual < 3.0) {
        nivel = 'rojo';
        razon = `Promedio proyectado ${nota_proyectada.toFixed(2)} por debajo del mínimo (3.0)`;
    } else if (score >= 35 || promedio_actual <= 3.5) {
        nivel = 'amarillo';
        razon = `Rendimiento en zona de atención (promedio: ${promedio_actual.toFixed(2)})`;
    } else {
        nivel = 'verde';
        razon = `Rendimiento satisfactorio (promedio: ${promedio_actual.toFixed(2)})`;
    }

    return {
        score: Math.round(score),
        nivel,
        nota_proyectada: parseFloat(nota_proyectada.toFixed(2)),
        promedio_actual: parseFloat(promedio_actual.toFixed(2)),
        pct_asistencia: parseFloat(pct_asistencia.toFixed(1)),
        razon,
        detalle: { ausentes_no_just, ausentes_just, presentes, total_clases }
    };
}

function calcularRiesgoEstudiante(estudianteId) {
    const db = getDB();
    const matriculas = db.prepare(`
    SELECT m.id, mat.nombre as materia, mat.codigo
    FROM matriculas m
    JOIN cursos c ON m.curso_id = c.id
    JOIN materias mat ON c.materia_id = mat.id
    JOIN periodos p ON c.periodo_id = p.id
    WHERE m.estudiante_id = ? AND p.activo = 1 AND m.estado = 'activa'
  `).all(estudianteId);

    return matriculas.map(m => ({
        matricula_id: m.id,
        materia: m.materia,
        codigo: m.codigo,
        ...calcularRiesgoMatricula(m.id)
    }));
}

function simularEscenario({ promedio_actual, pct_asistencia, nota_esperada_final, peso_pendiente }) {
    const β0 = 0.5, β1 = 0.7, β2 = 0.3;

    // Nota proyectada combinando actual + esperada en componente pendiente
    const promedio_simulado = peso_pendiente > 0
        ? promedio_actual * (1 - peso_pendiente / 100) + nota_esperada_final * (peso_pendiente / 100)
        : promedio_actual;

    let nota_proyectada = β0 + β1 * promedio_simulado + β2 * (pct_asistencia / 20);
    nota_proyectada = Math.max(0, Math.min(5, nota_proyectada));

    let score = 100 - (nota_proyectada / 5 * 50) - (pct_asistencia / 100 * 50);
    score = Math.max(0, Math.min(100, score));

    const aprueba = nota_proyectada >= 3.0;
    let nivel = score > 65 ? 'rojo' : score >= 35 ? 'amarillo' : 'verde';

    return {
        nota_proyectada: parseFloat(nota_proyectada.toFixed(2)),
        promedio_simulado: parseFloat(promedio_simulado.toFixed(2)),
        score: Math.round(score),
        nivel,
        aprueba,
        mensaje: aprueba
            ? `Con nota ${nota_esperada_final} en el componente pendiente, aprobarías con ${nota_proyectada.toFixed(2)}`
            : `Con nota ${nota_esperada_final}, el promedio proyectado sería ${nota_proyectada.toFixed(2)}, insuficiente para aprobar`
    };
}

module.exports = { calcularRiesgoMatricula, calcularRiesgoEstudiante, simularEscenario };
