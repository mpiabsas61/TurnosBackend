const express = require('express');

const router = express.Router();

const {
    obtenerServicios
} = require('../controllers/serviciosController');

router.get('/', obtenerServicios);


module.exports = router;