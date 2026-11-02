// Cliente de la API de usuarios (servicio a servicio).
// Se autentica con X-API-Key: nunca se reenvía el JWT del usuario.

const TIMEOUT_MS = 5000;

// Devuelve { nombre, apellido, rol, activo } o null si el usuario no existe
const obtenerUsuarioInterno = async (usuario_id) => {
    const baseUrl = process.env.USUARIOS_API_URL;
    const apiKey = process.env.API_KEY_INTERNA;

    if (!baseUrl || !apiKey) {
        throw new Error('Faltan USUARIOS_API_URL o API_KEY_INTERNA en el archivo .env');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/interno/usuarios/${encodeURIComponent(usuario_id)}`;

    const respuesta = await fetch(url, {
        headers: { 'X-API-Key': apiKey },
        signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (respuesta.status === 404) {
        return null;
    }

    if (!respuesta.ok) {
        throw new Error(`La API de usuarios respondió ${respuesta.status}`);
    }

    return respuesta.json();
};

module.exports = {
    obtenerUsuarioInterno
};
