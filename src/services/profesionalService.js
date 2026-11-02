const supabase = require('../config/supabase');
const { obtenerUsuarioInterno } = require('./usuariosApiService');

// Código de Postgres para violación de restricción UNIQUE
const VIOLACION_UNIQUE = '23505';

// Ver docs/diagrams/Diagrama registro profesional en turnos.puml
const altaProfesional = async ({ usuario_id, especialidad }) => {
    const { data: existentes, error: errorExistentes } = await supabase
        .from('PROFESIONAL')
        .select('id')
        .eq('usuario_id', usuario_id)
        .limit(1);

    if (errorExistentes) {
        throw errorExistentes;
    }

    if (existentes.length > 0) {
        return { resultado: 'ya_existe' };
    }

    const usuario = await obtenerUsuarioInterno(usuario_id);

    if (!usuario) {
        return { resultado: 'usuario_no_encontrado' };
    }

    if (usuario.rol !== 'profesional' || usuario.activo !== true) {
        return { resultado: 'usuario_no_valido' };
    }

    const { data: profesional, error } = await supabase
        .from('PROFESIONAL')
        .insert({
            usuario_id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            especialidad: especialidad.trim(),
            activo: true
        })
        .select()
        .single();

    if (error) {
        // Dos altas simultáneas del mismo usuario: la segunda choca con el índice único
        if (error.code === VIOLACION_UNIQUE) {
            return { resultado: 'ya_existe' };
        }

        throw error;
    }

    return { resultado: 'ok', profesional };
};

module.exports = {
    altaProfesional
};
