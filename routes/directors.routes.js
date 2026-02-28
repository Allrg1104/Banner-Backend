const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getDirectorKPIs } = require('../services/analytics.service');

router.get('/dashboard', auth, rbac('director', 'decano', 'admin'), (req, res) => {
    try {
        const kpis = getDirectorKPIs();
        res.json(kpis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
