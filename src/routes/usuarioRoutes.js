const express = require('express');

const router = express.Router();

const {
    obtenerUsuarios
} = require('../controllers/usuariosController');

router.get('/', obtenerUsuarios);


module.exports = router;    