const reservaService = require('../services/reservaService');

// Los errores inesperados los maneja errorMiddleware (Express 5 propaga los rechazos)

const obtenerReservas = async (req, res) => {
    const reservas = await reservaService.obtenerReservas({
        usuario_id: req.usuario.usuario_id
    });

    res.status(200).json(reservas);
};

const crearReserva = async (req, res) => {
    const { turno_id, servicio_id } = req.body;

    const { resultado, reserva } = await reservaService.crearReserva({
        usuario_id: req.usuario.usuario_id,
        turno_id,
        servicio_id
    });

    if (resultado === 'no_encontrado') {
        return res.status(404).json({
            mensaje: 'La franja no existe o no está disponible'
        });
    }

    if (resultado === 'servicio_no_ofrecido') {
        return res.status(422).json({
            mensaje: 'El profesional de la franja no ofrece el servicio indicado'
        });
    }

    if (resultado === 'ocupado') {
        return res.status(409).json({
            mensaje: 'La franja ya fue reservada por otro usuario'
        });
    }

    res.status(201).json({
        mensaje: 'Reserva creada correctamente',
        reserva
    });
};

const modificarReserva = async (req, res) => {
    const { resultado, reserva } = await reservaService.modificarReserva({
        usuario_id: req.usuario.usuario_id,
        turno_id: Number(req.params.id),
        nuevo_turno_id: req.body.nuevo_turno_id
    });

    if (resultado === 'misma_franja') {
        return res.status(400).json({
            mensaje: 'La nueva franja debe ser distinta de la actual'
        });
    }

    if (resultado === 'no_encontrado') {
        return res.status(404).json({
            mensaje: 'La reserva no existe o no pertenece al usuario'
        });
    }

    if (resultado === 'ocupado') {
        return res.status(409).json({
            mensaje: 'La nueva franja no está disponible para el mismo profesional'
        });
    }

    res.status(200).json({
        mensaje: 'Reserva modificada correctamente',
        reserva
    });
};

const cancelarReserva = async (req, res) => {
    const { resultado, turno } = await reservaService.cancelarReserva({
        usuario_id: req.usuario.usuario_id,
        turno_id: Number(req.params.id)
    });

    if (resultado === 'no_encontrado') {
        return res.status(404).json({
            mensaje: 'La reserva no existe o no pertenece al usuario'
        });
    }

    res.status(200).json({
        mensaje: 'Reserva cancelada correctamente',
        turno
    });
};

module.exports = {
    obtenerReservas,
    crearReserva,
    modificarReserva,
    cancelarReserva
};
