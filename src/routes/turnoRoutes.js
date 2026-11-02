const express = require('express');

const router = express.Router();

const {
    obtenerTurnos,
    generarTurnos
} = require('../controllers/turnosController');

const { verificarJWT, requerirRol } = require('../middlewares/authMiddleware');
const { validarBody, validarQuery } = require('../middlewares/validateMiddleware');

router.get(
    '/',
    validarQuery({ fecha: 'fecha', profesional_id: 'enteroPositivo', servicio_id: 'enteroPositivo' }),
    obtenerTurnos
);

router.post(
    '/generar',
    verificarJWT,
    requerirRol('administrador'),
    validarBody({ fecha: 'fecha', servicio_id: 'enteroPositivo' }),
    generarTurnos
);

module.exports = router;