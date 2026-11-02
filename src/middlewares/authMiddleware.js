const jwt = require('jsonwebtoken');

// Verifica el JWT emitido por la API de usuarios (firma y expiración, localmente)
const verificarJWT = (req, res, next) => {
    const secreto = process.env.JWT_SECRET;

    if (!secreto) {
        return next(new Error('Falta JWT_SECRET en el archivo .env'));
    }

    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({
            mensaje: 'Token de autenticación requerido'
        });
    }

    try {
        const payload = jwt.verify(token, secreto);

        // La API de usuarios firma el ObjectId de MongoDB en el claim "id"
        if (!payload.id) {
            return res.status(401).json({
                mensaje: 'Token inválido'
            });
        }

        req.usuario = {
            usuario_id: String(payload.id),
            rol: payload.rol
        };

        next();

    } catch (error) {
        res.status(401).json({
            mensaje: 'Token inválido o expirado'
        });
    }
};

// Restringe el acceso a los roles indicados. Debe usarse después de verificarJWT
const requerirRol = (...roles) => (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
        return res.status(403).json({
            mensaje: 'No tiene permisos para realizar esta acción'
        });
    }

    next();
};

module.exports = {
    verificarJWT,
    requerirRol
};
