const express = require('express');

const router = express.Router();

const {
    obtenerTurnos,
    generarTurnos
} = require('../controllers/turnosController');

router.get('/', obtenerTurnos);

router.post('/generar', generarTurnos);

module.exports = router;