const nodemailer = require('nodemailer');

// Transporter - en dev usa Mailtrap / Ethereal
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT) || 587,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
});

const FROM = `"${process.env.EMAIL_FROM_NAME || 'Plataforma Académica'}" <${process.env.EMAIL_FROM || 'noreply@unicatolica.edu.co'}>`;
const INSTITUTION = process.env.INSTITUTION_NAME || 'Universidad Católica';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

function baseTemplate(titulo, contenido) {
    return `<!DOCTYPE html><html><body style="margin:0;font-family:Arial,sans-serif;background:#f4f4f4">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#1a2f6c,#2563eb);padding:30px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px">🎓 ${INSTITUTION}</h1>
      <p style="color:rgba(255,255,255,0.8);margin:5px 0 0">${titulo}</p>
    </div>
    <div style="padding:30px">${contenido}</div>
    <div style="background:#f8f8f8;padding:15px;text-align:center;color:#888;font-size:12px">
      © ${new Date().getFullYear()} ${INSTITUTION} · Sistema Académico Institucional
    </div>
  </div></body></html>`;
}

async function sendPasswordResetEmail(email, nombre, token) {
    const link = `${FRONTEND_URL}/#/reset-password?token=${token}`;
    const html = baseTemplate('Restablecimiento de Contraseña', `
    <h2 style="color:#1a2f6c">Hola, ${nombre}</h2>
    <p>Recibimos una solicitud para cambiar tu contraseña. Haz clic en el botón de abajo para confirmar el cambio:</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${link}" style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
        ✅ Confirmar cambio de contraseña
      </a>
    </div>
    <p style="color:#888;font-size:13px">⏰ Este enlace expira en <strong>15 minutos</strong>.</p>
    <p style="color:#888;font-size:13px">Si no solicitaste este cambio, ignora este mensaje. Tu contraseña permanecerá igual.</p>
  `);

    return transporter.sendMail({
        from: FROM,
        to: email,
        subject: `🔐 Confirmación de cambio de contraseña - ${INSTITUTION}`,
        html
    });
}

async function sendNewInvoiceEmail(email, nombre, factura) {
    const html = baseTemplate('Nueva Factura Generada', `
    <h2 style="color:#1a2f6c">Hola, ${nombre}</h2>
    <p>Se ha generado una nueva factura para tu cuenta:</p>
    <div style="background:#f0f7ff;border-left:4px solid #2563eb;padding:20px;border-radius:0 8px 8px 0;margin:20px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#555"><strong>N° Factura:</strong></td><td style="color:#1a2f6c;font-weight:bold">${factura.numero_factura}</td></tr>
        <tr><td style="padding:6px 0;color:#555"><strong>Concepto:</strong></td><td>${factura.concepto}</td></tr>
        <tr><td style="padding:6px 0;color:#555"><strong>Valor:</strong></td><td style="font-size:20px;color:#059669;font-weight:bold">$${factura.valor.toLocaleString('es-CO')}</td></tr>
        <tr><td style="padding:6px 0;color:#555"><strong>Vence:</strong></td><td style="color:#dc2626;font-weight:bold">${factura.fecha_vencimiento}</td></tr>
      </table>
    </div>
    <p>Puedes pagar en línea o realizar el pago en cualquier banco habilitado.</p>
  `);

    return transporter.sendMail({
        from: FROM,
        to: email,
        subject: `🧾 Nueva factura ${factura.numero_factura} - ${INSTITUTION}`,
        html
    });
}

async function sendPaymentConfirmEmail(email, nombre, pago, factura) {
    const html = baseTemplate('Pago Confirmado', `
    <h2 style="color:#059669">✅ Pago Recibido Exitosamente</h2>
    <p>Hola <strong>${nombre}</strong>, tu pago ha sido procesado correctamente.</p>
    <div style="background:#f0fdf4;border-left:4px solid #059669;padding:20px;border-radius:0 8px 8px 0;margin:20px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#555"><strong>Factura:</strong></td><td>${factura.numero_factura}</td></tr>
        <tr><td style="padding:6px 0;color:#555"><strong>Valor pagado:</strong></td><td style="color:#059669;font-weight:bold">$${pago.valor.toLocaleString('es-CO')}</td></tr>
        <tr><td style="padding:6px 0;color:#555"><strong>Método:</strong></td><td>${pago.metodo === 'virtual' ? '💳 Pasarela Virtual' : '🏦 Pago en Banco'}</td></tr>
        <tr><td style="padding:6px 0;color:#555"><strong>Referencia:</strong></td><td style="font-family:monospace;background:#e5e7eb;padding:2px 6px;border-radius:4px">${pago.referencia}</td></tr>
        <tr><td style="padding:6px 0;color:#555"><strong>Fecha:</strong></td><td>${new Date().toLocaleString('es-CO')}</td></tr>
      </table>
    </div>
    <p style="color:#888;font-size:13px">Conserva tu referencia de pago como comprobante.</p>
  `);

    return transporter.sendMail({
        from: FROM,
        to: email,
        subject: `✅ Pago confirmado - ${factura.numero_factura} - ${INSTITUTION}`,
        html
    });
}

async function sendRetentionAlertEmail(email, nombre, factura) {
    const html = baseTemplate('⚠️ Alerta de Retención Académica', `
    <h2 style="color:#dc2626">⚠️ Tu cuenta tiene una retención activa</h2>
    <p>Hola <strong>${nombre}</strong>, debido a la falta de pago de la factura <strong>${factura.numero_factura}</strong>, se ha activado una retención en tu cuenta académica.</p>
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:20px;border-radius:0 8px 8px 0;margin:20px 0">
      <p><strong>💰 Valor pendiente:</strong> $${factura.valor.toLocaleString('es-CO')}</p>
      <p><strong>📅 Fecha de vencimiento:</strong> ${factura.fecha_vencimiento}</p>
    </div>
    <p><strong>Consecuencias de la retención:</strong></p>
    <ul style="color:#555">
      <li>Bloqueo de servicios académicos en línea</li>
      <li>No podrás inscribir materias para el próximo periodo</li>
      <li>No se expedirán certificados ni notas</li>
    </ul>
    <p>Realiza tu pago a la mayor brevedad posible para levantar la retención.</p>
  `);

    return transporter.sendMail({
        from: FROM,
        to: email,
        subject: `⚠️ Retención activa en tu cuenta - ${INSTITUTION}`,
        html
    });
}

async function sendTempPasswordEmail(email, nombre, username, tempPassword) {
    const html = baseTemplate('Credenciales de Acceso', `
    <h2 style="color:#1a2f6c">Bienvenido/a, ${nombre}</h2>
    <p>Se ha creado tu cuenta en la Plataforma Académica Institucional. Aquí están tus credenciales de acceso:</p>
    <div style="background:#f0f7ff;border:2px dashed #2563eb;padding:20px;border-radius:8px;text-align:center;margin:20px 0">
      <p style="margin:8px 0;font-size:16px"><strong>Usuario:</strong> <span style="font-family:monospace;background:#1a2f6c;color:#fff;padding:4px 12px;border-radius:4px">${username}</span></p>
      <p style="margin:8px 0;font-size:16px"><strong>Contraseña temporal:</strong> <span style="font-family:monospace;background:#dc2626;color:#fff;padding:4px 12px;border-radius:4px">${tempPassword}</span></p>
    </div>
    <p style="color:#dc2626;font-weight:bold">⚠️ Por seguridad, debes cambiar tu contraseña en el primer inicio de sesión.</p>
    <div style="text-align:center;margin-top:20px">
      <a href="${FRONTEND_URL}" style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold">
        🚀 Acceder a la Plataforma
      </a>
    </div>
  `);

    return transporter.sendMail({
        from: FROM,
        to: email,
        subject: `🎓 Tus credenciales de acceso - ${INSTITUTION}`,
        html
    });
}

module.exports = {
    sendPasswordResetEmail,
    sendNewInvoiceEmail,
    sendPaymentConfirmEmail,
    sendRetentionAlertEmail,
    sendTempPasswordEmail
};
