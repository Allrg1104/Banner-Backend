const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getDB } = require('../database/db');
const { getFinancialKPIs } = require('../services/analytics.service');
const { generarFacturaParaEstudiante, generarFacturasMasivas, verificarVencimientosYRetenciones } = require('../services/invoice.service');
const { sendPaymentConfirmEmail } = require('../services/email.service');

router.get('/dashboard', auth, rbac('financiero', 'admin'), (req, res) => {
    res.json(getFinancialKPIs());
});

router.get('/invoices/:studentId', auth, (req, res) => {
    if (req.user.rol === 'estudiante' && req.user.id !== parseInt(req.params.studentId)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    const db = getDB();
    const invoices = db.prepare('SELECT * FROM facturas WHERE estudiante_id = ? ORDER BY fecha_emision DESC').all(req.params.studentId);
    res.json(invoices);
});

// Pago simulado (Virtual)
router.post('/pay-virtual', auth, async (req, res) => {
    const { facturaId, tarjetaMock } = req.body;
    const db = getDB();
    const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(facturaId);
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    if (factura.estado === 'pagada') return res.status(400).json({ error: 'La factura ya está pagada' });

    const persona = db.prepare('SELECT nombres, email FROM personas WHERE id = ?').get(factura.estudiante_id);
    const referencia = `REF-VRT-${Date.now()}`;

    db.transaction(() => {
        db.prepare("UPDATE facturas SET estado = 'pagada' WHERE id = ?").run(facturaId);
        db.prepare("UPDATE estudiantes SET tiene_retencion = 0 WHERE persona_id = ?").run(factura.estudiante_id);
        db.prepare(`
      INSERT INTO pagos(factura_id, valor, metodo, referencia, datos_pasarela)
      VALUES (?, ?, 'virtual', ?, ?)
    `).run(facturaId, factura.valor, referencia, JSON.stringify({ tarjeta: '****' + tarjetaMock.slice(-4) }));
    })();

    const pago = { valor: factura.valor, metodo: 'virtual', referencia };
    if (persona.email) await sendPaymentConfirmEmail(persona.email, persona.nombres, pago, factura);

    res.json({ message: 'Pago simulado aprobado', referencia });
});

// Admin/Financiero tools
router.post('/generate-bulk', auth, rbac('financiero', 'admin'), async (req, res) => {
    const { periodoId, concepto, valor } = req.body;
    const results = await generarFacturasMasivas(periodoId, concepto, valor);
    res.json({ message: 'Proceso de facturación masiva completado', results });
});

router.post('/check-overdue', auth, rbac('financiero', 'admin'), async (req, res) => {
    const count = await verificarVencimientosYRetenciones();
    res.json({ message: `Se procesaron ${count} facturas vencidas` });
});

module.exports = router;
