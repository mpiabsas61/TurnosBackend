const supabase = require('../config/supabase');
const { fechaHoy } = require('../utils/fechas');

// Cada función devuelve { resultado } y el controller lo traduce a un código HTTP.
// Los errores de base de datos se lanzan.

// Reservas vigentes (desde hoy) del usuario, con los datos del servicio y del
// profesional. TURNO no tiene claves foráneas definidas en la base, así que no
// se puede usar el embedding de Supabase y se cruzan los datos acá
const obtenerReservas = async ({ usuario_id }) => {
    const { data: turnos, error } = await supabase
        .from('TURNO')
        .select('*')
        .eq('usuario_id', usuario_id)
        .eq('estado', 'reservado')
        .gte('fecha', fechaHoy())
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

    if (error) {
        throw error;
    }

    if (turnos.length === 0) {
        return [];
    }

    const [servicios, profesionales] = await Promise.all([
        supabase
            .from('SERVICIO')
            .select('id, nombre, categoria, duracion, precio')
            .in('id', [...new Set(turnos.map(t => t.servicio_id))]),
        supabase
            .from('PROFESIONAL')
            .select('id, nombre, apellido, especialidad')
            .in('id', [...new Set(turnos.map(t => t.profesional_id))])
    ]);

    if (servicios.error) {
        throw servicios.error;
    }

    if (profesionales.error) {
        throw profesionales.error;
    }

    const serviciosPorId = new Map(servicios.data.map(s => [s.id, s]));
    const profesionalesPorId = new Map(profesionales.data.map(p => [p.id, p]));

    return turnos.map(turno => ({
        ...turno,
        servicio: serviciosPorId.get(turno.servicio_id) || null,
        profesional: profesionalesPorId.get(turno.profesional_id) || null
    }));
};

// Ver docs/diagrams/Diagrama reserva turno.puml
const crearReserva = async ({ usuario_id, turno_id, servicio_id }) => {
    // La franja debe existir, estar disponible y no ser de una fecha pasada
    const { data: turno, error: errorTurno } = await supabase
        .from('TURNO')
        .select('*')
        .eq('id', turno_id)
        .eq('estado', 'disponible')
        .gte('fecha', fechaHoy())
        .maybeSingle();

    if (errorTurno) {
        throw errorTurno;
    }

    if (!turno) {
        return { resultado: 'no_encontrado' };
    }

    // El profesional de la franja debe ofrecer el servicio
    const { data: relaciones, error: errorRelacion } = await supabase
        .from('PROFESIONAL_SERVICIO')
        .select('id')
        .eq('profesional_id', turno.profesional_id)
        .eq('servicio_id', servicio_id)
        .eq('activo', true)
        .limit(1);

    if (errorRelacion) {
        throw errorRelacion;
    }

    if (relaciones.length === 0) {
        return { resultado: 'servicio_no_ofrecido' };
    }

    // UPDATE condicional: si otro usuario la tomó antes, no se modifica ninguna fila
    const { data: reservados, error } = await supabase
        .from('TURNO')
        .update({ estado: 'reservado', usuario_id, servicio_id })
        .eq('id', turno_id)
        .eq('estado', 'disponible')
        .select();

    if (error) {
        throw error;
    }

    if (reservados.length === 0) {
        return { resultado: 'ocupado' };
    }

    return { resultado: 'ok', reserva: reservados[0] };
};

// Ver docs/diagrams/Diagrama modificacion turno.puml
// Reservar la nueva franja y liberar la anterior se hace en una sola transacción
// con la función de Postgres modificar_reserva (docs/database/001_reservas.sql)
const modificarReserva = async ({ usuario_id, turno_id, nuevo_turno_id }) => {
    if (turno_id === nuevo_turno_id) {
        return { resultado: 'misma_franja' };
    }

    const { data, error } = await supabase.rpc('modificar_reserva', {
        p_turno_id: turno_id,
        p_nuevo_turno_id: nuevo_turno_id,
        p_usuario_id: usuario_id,
        p_fecha_minima: fechaHoy()
    });

    if (error) {
        throw error;
    }

    return data;
};

// Ver docs/diagrams/Diagrama cancelacion turno.puml
const cancelarReserva = async ({ usuario_id, turno_id }) => {
    const { data: cancelados, error } = await supabase
        .from('TURNO')
        .update({ estado: 'disponible', usuario_id: null, servicio_id: null })
        .eq('id', turno_id)
        .eq('usuario_id', usuario_id)
        .eq('estado', 'reservado')
        .select();

    if (error) {
        throw error;
    }

    if (cancelados.length === 0) {
        return { resultado: 'no_encontrado' };
    }

    return { resultado: 'ok', turno: cancelados[0] };
};

module.exports = {
    obtenerReservas,
    crearReserva,
    modificarReserva,
    cancelarReserva
};
