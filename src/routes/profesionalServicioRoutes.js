const express = require('express');

const router = express.Router();

const {
    obtenerProfesionalServicios
} = require('../controllers/profesionalServicioController');

router.get('/', obtenerProfesionalServicios);


module.exports = router;