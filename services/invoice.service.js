const { getDB } = require('../database/db');
const { sendNewInvoiceEmail, sendRetentionAlertEmail } = require('./email.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Servicio de Facturación (Inspirado en SIESA)
 */

async function generarFacturaParaEstudiante(personaId, periodoId, concepto, valor) {
    const db = getDB();

    // Buscar periodo
    const periodo = db.prepare('SELECT nombre, fecha_inicio FROM periodos WHERE id = ?').get(periodoId);
    if (!periodo) throw new Error('Periodo no encontrado');

    const numeroFactura = `FACT-${periodo.nombre}-${uuidv4().substring(0, 8).toUpperCase()}`;
    const fechaVencimiento = periodo.fecha_inicio; // Por defecto vence cuando inicia el periodo

    const stmt = db.prepare(`
    INSERT INTO facturas (estudiante_id, periodo_id, concepto, valor, fecha_vencimiento, estado, numero_factura)
    VALUES (?, ?, ?, ?, ?, 'pendiente', ?)
  `);

    const info = stmt.run(personaId, periodoId, concepto, valor, fechaVencimiento, numeroFactura);
    const facturaId = info.lastInsertRowid;

    const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(facturaId);
    const persona = db.prepare('SELECT nombres, email FROM personas WHERE id = ?').get(personaId);

    // Enviar correo (simulado)
    if (persona && persona.email) {
        await sendNewInvoiceEmail(persona.email, persona.nombres, factura);
    }

    return factura;
}

async function generarFacturasMasivas(periodoId, concepto, valor) {
    const db = getDB();

    // Estudiantes activos con programa
    const estudiantes = db.prepare(`
    SELECT p.id, p.nombres, p.email 
    FROM personas p
    JOIN estudiantes e ON p.id = e.persona_id
    WHERE e.estado = 'activo' AND p.rol = 'estudiante'
  `).all();

    const resultados = [];
    for (const est of estudiantes) {
        try {
            const factura = await generarFacturaParaEstudiante(est.id, periodoId, concepto, valor);
            resultados.push({ id: est.id, status: 'success', facturaId: factura.id });
        } catch (err) {
            resultados.push({ id: est.id, status: 'error', message: err.message });
        }
    }

    return resultados;
}

async function verificarVencimientosYRetenciones() {
    const db = getDB();
    const hoy = new Date().toISOString().split('T')[0];

    // Buscar facturas vencidas no pagadas que no estén en retención
    const vencidas = db.prepare(`
    SELECT f.*, p.nombres, p.email
    FROM facturas f
    JOIN personas p ON f.estudiante_id = p.id
    WHERE f.estado = 'pendiente' AND f.fecha_vencimiento < ?
  `).all(hoy);

    for (const f of vencidas) {
        db.prepare("UPDATE facturas SET estado = 'retencion' WHERE id = ?").run(f.id);
        db.prepare("UPDATE estudiantes SET tiene_retencion = 1 WHERE persona_id = ?").run(f.estudiante_id);

        // Alerta por correo
        if (f.email) {
            await sendRetentionAlertEmail(f.email, f.nombres, f);
        }
    }

    return vencidas.length;
}

module.exports = {
    generarFacturaParaEstudiante,
    generarFacturasMasivas,
    verificarVencimientosYRetenciones
};
