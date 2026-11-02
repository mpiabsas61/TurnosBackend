// Manejo centralizado de errores. Debe registrarse después de todas las rutas
const errorMiddleware = (err, req, res, next) => {
    // JSON mal formado en el body
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            mensaje: 'El cuerpo de la solicitud no es un JSON válido'
        });
    }

    console.error(err);

    res.status(500).json({
        mensaje: 'Error interno del servidor'
    });
};

module.exports = errorMiddleware;
