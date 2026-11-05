const express = require('express');

const router = express.Router();

const {
    obtenerProfesionales,
    crearProfesional
} = require('../controllers/profesionalController');

const { verificarJWT, requerirRol } = require('../middlewares/authMiddleware');
const { validarBody, validarQuery } = require('../middlewares/validateMiddleware');

router.get('/', validarQuery({ servicio_id: 'enteroPositivo' }), obtenerProfesionales);

router.post(
    '/',
    verificarJWT,
    requerirRol('administrador'),
    validarBody({ usuario_id: 'texto', especialidad: 'texto' }),
    crearProfesional
);

module.exports = router;
