const supabase = require('../config/supabase');
const { obtenerUsuarioInterno } = require('./usuariosApiService');

// Código de Postgres para violación de restricción UNIQUE
const VIOLACION_UNIQUE = '23505';

// Profesionales activos, cada uno con los servicios activos que ofrece.
// Con servicio_id, solo los que ofrecen ese servicio. PROFESIONAL_SERVICIO se
// resuelve acá y no se expone: se cruzan los datos igual que en obtenerReservas
const obtenerProfesionales = async ({ servicio_id } = {}) => {
    let consultaRelaciones = supabase
        .from('PROFESIONAL_SERVICIO')
        .select('profesional_id, servicio_id')
        .eq('activo', true);

    if (servicio_id) {
        consultaRelaciones = consultaRelaciones.eq('servicio_id', servicio_id);
    }

    const { data: relaciones, error: errorRelaciones } = await consultaRelaciones;

    if (errorRelaciones) {
        throw errorRelaciones;
    }

    if (servicio_id && relaciones.length === 0) {
        return [];
    }

    let consultaProfesionales = supabase
        .from('PROFESIONAL')
        .select('*')
        .eq('activo', true)
        .order('id', { ascending: true });

    if (servicio_id) {
        consultaProfesionales = consultaProfesionales
            .in('id', [...new Set(relaciones.map(r => r.profesional_id))]);
    }

    const { data: profesionales, error: errorProfesionales } = await consultaProfesionales;

    if (errorProfesionales) {
        throw errorProfesionales;
    }

    if (profesionales.length === 0) {
        return [];
    }

    // Servicios de los profesionales listados. Con el filtro hay que volver a pedir
    // todas sus relaciones, porque cada profesional trae todos sus servicios
    let relacionesListadas = relaciones;

    if (servicio_id) {
        const { data, error } = await supabase
            .from('PROFESIONAL_SERVICIO')
            .select('profesional_id, servicio_id')
            .eq('activo', true)
            .in('profesional_id', profesionales.map(p => p.id));

        if (error) {
            throw error;
        }

        relacionesListadas = data;
    }

    const { data: servicios, error: errorServicios } = await supabase
        .from('SERVICIO')
        .select('id, nombre, categoria, duracion, precio')
        .eq('activo', true)
        .in('id', [...new Set(relacionesListadas.map(r => r.servicio_id))]);

    if (errorServicios) {
        throw errorServicios;
    }

    const serviciosPorId = new Map(servicios.map(s => [s.id, s]));

    const resultado = profesionales.map(profesional => ({
        ...profesional,
        servicios: relacionesListadas
            .filter(r => r.profesional_id === profesional.id && serviciosPorId.has(r.servicio_id))
            .map(r => serviciosPorId.get(r.servicio_id))
            .sort((a, b) => a.id - b.id)
    }));

    // Si el servicio pedido no está activo, nadie lo ofrece
    if (servicio_id) {
        return resultado.filter(p => p.servicios.some(s => s.id === servicio_id));
    }

    return resultado;
};

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
    obtenerProfesionales,
    altaProfesional
};
