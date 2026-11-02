const express = require('express');

const router = express.Router();

const {
    obtenerReservas,
    crearReserva,
    modificarReserva,
    cancelarReserva
} = require('../controllers/reservaController');

const { verificarJWT } = require('../middlewares/authMiddleware');
const { validarBody, validarParams } = require('../middlewares/validateMiddleware');

router.get('/', verificarJWT, obtenerReservas);

router.post(
    '/',
    verificarJWT,
    validarBody({ turno_id: 'enteroPositivo', servicio_id: 'enteroPositivo' }),
    crearReserva
);

router.patch(
    '/:id',
    verificarJWT,
    validarParams({ id: 'enteroPositivo' }),
    validarBody({ nuevo_turno_id: 'enteroPositivo' }),
    modificarReserva
);

router.delete(
    '/:id',
    verificarJWT,
    validarParams({ id: 'enteroPositivo' }),
    cancelarReserva
);

module.exports = router;
