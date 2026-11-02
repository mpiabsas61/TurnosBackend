# API de Turnos: guía para el frontend

Este documento describe qué rutas ofrece la API de Turnos y qué pantallas y funcionalidades tiene que construir el frontend con ellas.

---

## 1. Datos generales

| | |
|---|---|
| **URL base (producción)** | `https://<url-de-la-api-de-turnos>.vercel.app` *(a completar)* |
| **URL base (local)** | `http://localhost:3001` |
| **Formato** | JSON. Enviar `Content-Type: application/json` en los `POST` y `PATCH`. |
| **CORS** | Abierto. Se puede llamar desde cualquier origen. |
| **Fechas** | Texto `YYYY-MM-DD` (ej. `2026-11-03`). |
| **Horas** | Texto `HH:MM:SS` (ej. `09:00:00`). Zona horaria: Argentina. |
| **IDs numéricos** | En los body van como **número** (`1`), no como texto (`"1"`). Si van como texto, la API responde `400`. |

---

## 2. Autenticación

Esta API **no tiene login**. El usuario inicia sesión en la **API de Usuarios** (`https://backend-usuarios.vercel.app`), que devuelve un token JWT. Ese mismo token se envía a esta API en cada ruta protegida:

```
Authorization: Bearer <token>
```

El token trae (se puede leer decodificándolo, sin verificar):

```json
{
  "id": "665f1c2a9b3e4d0012a7c3f1",
  "rol": "administrador",
  "exp": 1793562282
}
```

- `rol` sirve para mostrar u ocultar funciones de administrador (`"administrador"`).
- `exp` es el vencimiento, en segundos desde 1970. Hoy los tokens duran **1 hora**.

| Respuesta | Qué hacer en el frontend |
|---|---|
| `401` | Falta el token, es inválido o venció. Redirigir al login. |
| `403` | El usuario no tiene permiso (ej. no es administrador). Mostrar un mensaje y no reintentar. |

---

## 3. Formato de errores

Todas las respuestas de error tienen esta forma:

```json
{
  "mensaje": "Texto legible para mostrar al usuario",
  "error": "Detalle técnico (a veces)"
}
```

Se puede mostrar `mensaje` directamente al usuario. `error` es para depurar.

---

## 4. Modelos de datos

**Servicio**

```json
{
  "id": 1,
  "nombre": "Limpieza facial",
  "categoria": "Tratamiento facial",
  "descripcion": "Punta de diamante, extracciones manuales...",
  "duracion": 60,
  "precio": 50000,
  "activo": true
}
```

`duracion` está en minutos y `precio` en pesos, sin decimales. Todos los servicios duran 60 minutos.

**Profesional**

```json
{
  "id": 7,
  "nombre": "Martín",
  "apellido": "Sosa",
  "especialidad": "Tratamientos faciales y corporales",
  "activo": true,
  "usuario_id": "6ae761442b19072bbffa20c3"
}
```

**Profesional–Servicio** (qué servicios hace cada profesional)

```json
{ "id": 12, "profesional_id": 7, "servicio_id": 2, "activo": true }
```

**Turno** (una franja horaria de un profesional)

```json
{
  "id": 1501,
  "profesional_id": 7,
  "servicio_id": null,
  "usuario_id": null,
  "fecha": "2026-11-03",
  "hora_inicio": "10:00:00",
  "hora_fin": "11:00:00",
  "estado": "disponible"
}
```

- `estado` es `"disponible"` o `"reservado"`.
- Mientras está disponible, `servicio_id` y `usuario_id` son `null`. Al reservarse, se completan.

---

## 5. Rutas

### Resumen

| Método | Ruta | Requiere token | Para qué |
|---|---|---|---|
| `GET` | `/api/servicios` | No | Catálogo de servicios |
| `GET` | `/api/profesionales` | No | Lista de profesionales |
| `GET` | `/api/profesionalServicio` | No | Qué servicios hace cada profesional |
| `GET` | `/api/turnos` | No | Franjas disponibles (con filtros) |
| `GET` | `/api/reservas` | Sí | Mis reservas |
| `POST` | `/api/reservas` | Sí | Reservar una franja |
| `PATCH` | `/api/reservas/:id` | Sí | Cambiar una reserva a otra franja |
| `DELETE` | `/api/reservas/:id` | Sí | Cancelar una reserva |
| `POST` | `/api/turnos/generar` | Sí, administrador | Generar franjas de un día |
| `POST` | `/api/profesionales` | Sí, administrador | Dar de alta un profesional |

---

### `GET /api/servicios`

Devuelve los servicios activos.

```
200 → [ Servicio, ... ]
```

### `GET /api/profesionales`

Devuelve los profesionales activos.

```
200 → [ Profesional, ... ]
```

### `GET /api/profesionalServicio`

Devuelve las relaciones activas entre profesionales y servicios. Trae **solo IDs**: para mostrar nombres, cruzar con `/api/servicios` y `/api/profesionales`.

```
200 → [ { "id": 12, "profesional_id": 7, "servicio_id": 2, "activo": true }, ... ]
```

### `GET /api/turnos`

Devuelve las franjas **disponibles** desde hoy, ordenadas por fecha y hora. Todos los filtros son opcionales y se pueden combinar:

| Parámetro | Ejemplo | Filtra por |
|---|---|---|
| `fecha` | `2026-11-03` | Un día |
| `profesional_id` | `7` | Un profesional |
| `servicio_id` | `2` | Profesionales que hacen ese servicio |

```
GET /api/turnos?servicio_id=2&fecha=2026-11-03

200 → [ Turno, ... ]
400 → algún filtro con formato incorrecto
```

> ⚠️ El filtro es por **día**: hoy se devuelven también las franjas de horas que ya pasaron. El frontend debe ocultar las de hoy cuya `hora_inicio` ya pasó.

> 💡 Sin filtros, la respuesta trae todo el mes (cientos de franjas). Conviene pedir siempre por `servicio_id` y `fecha`.

---

### `GET /api/reservas`

Devuelve las reservas vigentes del usuario del token: desde hoy, ordenadas por fecha y hora. Cada reserva es un Turno, con los datos del servicio y del profesional incluidos, lista para mostrar.

```json
[
  {
    "id": 1244,
    "profesional_id": 10,
    "servicio_id": 13,
    "usuario_id": "665f1c2a9b3e4d0012a7c3f1",
    "fecha": "2026-11-30",
    "hora_inicio": "17:00:00",
    "hora_fin": "18:00:00",
    "estado": "reservado",
    "servicio": {
      "id": 13,
      "nombre": "Radiofrecuencia",
      "categoria": "Tratamiento corporal",
      "duracion": 60,
      "precio": 45000
    },
    "profesional": {
      "id": 10,
      "nombre": "Nicolás",
      "apellido": "Herrera",
      "especialidad": "Tratamientos faciales y corporales"
    }
  }
]
```

| Código | Significado |
|---|---|
| `200` | Lista de reservas. Si no tiene ninguna, `[]`. |
| `401` | Sin sesión. |

> Igual que en `/api/turnos`, hoy se incluyen también las reservas de horas que ya pasaron.

### `POST /api/reservas`

Reserva una franja para un servicio. El usuario se toma del token.

```json
{
  "turno_id": 1501,
  "servicio_id": 2
}
```

| Código | Significado | Qué hacer |
|---|---|---|
| `201` | Reservado. Devuelve `{ mensaje, reserva }`, donde `reserva` es el Turno ya reservado. | Mostrar confirmación. |
| `400` | Datos con formato incorrecto. | Error de programación: revisar el body. |
| `401` | Sin sesión. | Ir al login. |
| `404` | La franja no existe, ya no está disponible o es de una fecha pasada. | Avisar y recargar las franjas. |
| `409` | Otro usuario la reservó un instante antes. | Avisar ("Ese horario acaba de ser tomado") y recargar las franjas. |
| `422` | El profesional de esa franja no hace ese servicio. | Error de programación: la franja no corresponde al servicio elegido. |

### `PATCH /api/reservas/:id`

Cambia una reserva del usuario a **otra franja del mismo profesional**. `:id` es el `id` del turno reservado actualmente. El servicio se mantiene.

```json
{
  "nuevo_turno_id": 1505
}
```

| Código | Significado |
|---|---|
| `200` | Modificada. Devuelve `{ mensaje, reserva }` con la **nueva** franja. La anterior queda libre. |
| `400` | Formato incorrecto, o la nueva franja es la misma que la actual. |
| `401` | Sin sesión. |
| `404` | La reserva no existe o no es del usuario. |
| `409` | La nueva franja no está disponible, es de otro profesional o es de una fecha pasada. Recargar las franjas. |

Para elegir la nueva franja, pedir `GET /api/turnos?profesional_id=<profesional de la reserva>`.

### `DELETE /api/reservas/:id`

Cancela una reserva del usuario. La franja vuelve a quedar disponible.

| Código | Significado |
|---|---|
| `200` | Cancelada. Devuelve `{ mensaje, turno }`. |
| `400` | `:id` con formato incorrecto. |
| `401` | Sin sesión. |
| `404` | La reserva no existe o no es del usuario. |

---

### `POST /api/turnos/generar` (administrador)

Genera las franjas disponibles de **un día** para los profesionales que hacen un servicio. Las franjas son de lunes a viernes, de 09:00 a 18:00, de una hora cada una. Si ya existen, no se duplican.

```json
{
  "fecha": "2026-12-01",
  "servicio_id": 1
}
```

| Código | Significado |
|---|---|
| `201` | Generadas. Devuelve `{ mensaje, turnos: [Turno, ...] }`. |
| `200` | No había nada para generar (ya existían, o ningún profesional hace ese servicio). Devuelve `{ mensaje }`. |
| `400` | Formato incorrecto, o la fecha cae sábado o domingo. |
| `401` / `403` | Sin sesión / no es administrador. |
| `404` | El servicio no existe. |

> Para generar un día completo para todos los profesionales, llamar una vez por cada servicio. Las franjas repetidas se saltean solas.

### `POST /api/profesionales` (administrador)

Da de alta como profesional a un usuario que ya existe en la API de Usuarios con rol `profesional`. El nombre y el apellido se toman de esa API.

```json
{
  "usuario_id": "6ae761442b19072bbffa20c3",
  "especialidad": "Tratamientos faciales"
}
```

| Código | Significado |
|---|---|
| `201` | Creado. Devuelve `{ mensaje, profesional }`. |
| `400` | Faltan datos. |
| `401` / `403` | Sin sesión / no es administrador. |
| `404` | El usuario no existe en la API de Usuarios. |
| `409` | Ese usuario ya es profesional. |
| `422` | El usuario no tiene rol `profesional` o está inactivo. |

---

## 6. Funcionalidades a construir

### Para cualquier visitante (sin sesión)

**Catálogo de servicios**
- Lista de servicios con nombre, categoría, descripción, duración y precio (`GET /api/servicios`).
- Agrupar o filtrar por `categoria` ("Tratamiento facial", "Tratamiento corporal").

**Equipo**
- Lista de profesionales con su especialidad (`GET /api/profesionales`).
- Opcional: mostrar qué servicios hace cada uno (cruzar con `GET /api/profesionalServicio`).

### Para usuarios con sesión

**Reservar un turno.** Flujo sugerido:

```
1. Elegir servicio            → GET /api/servicios
2. (Opcional) elegir profesional
                              → GET /api/profesionalServicio + GET /api/profesionales
                                (solo los que hacen ese servicio)
3. Elegir día                 → calendario de lunes a viernes, desde hoy
4. Elegir horario             → GET /api/turnos?servicio_id=X&fecha=Y[&profesional_id=Z]
                                Mostrar hora_inicio–hora_fin y el nombre del profesional.
                                Ocultar horarios de hoy que ya pasaron.
5. Confirmar                  → POST /api/reservas { turno_id, servicio_id }
6. Pantalla de confirmación con servicio, profesional, fecha y hora.
```

- Si el usuario no tiene sesión al confirmar, enviarlo al login y volver al paso 5.
- Ante `404` o `409`, avisar y volver al paso 4 con las franjas recargadas.
- Deshabilitar el botón de confirmar mientras se envía, para evitar doble envío.

**Mis turnos**
- Lista de reservas vigentes (`GET /api/reservas`) con servicio, profesional, fecha, horario y precio.
- Si la lista está vacía, mostrar un acceso directo a "Reservar un turno".
- Cada reserva tiene dos acciones: **Cambiar horario** y **Cancelar**.
- Después de reservar, modificar o cancelar, volver a pedir `GET /api/reservas` para refrescar la lista.

**Cambiar el horario de una reserva** (desde "Mis turnos")
- Mostrar las franjas del mismo profesional (`GET /api/turnos?profesional_id=<reserva.profesional_id>`).
- Confirmar con `PATCH /api/reservas/<reserva.id> { nuevo_turno_id }`.

**Cancelar una reserva** (desde "Mis turnos")
- Pedir confirmación ("¿Seguro que querés cancelar?") y llamar a `DELETE /api/reservas/<reserva.id>`.

### Para administradores (`rol = "administrador"`)

**Generar agenda**
- Formulario con rango de fechas. Por cada día hábil del rango y por cada servicio, llamar a `POST /api/turnos/generar`.
- Mostrar cuántos turnos se crearon en total (sumar `turnos.length` de las respuestas `201`).

**Alta de profesional**
- Formulario con `usuario_id` (ID del usuario en la API de Usuarios) y `especialidad`.
- Si la API de Usuarios ofrece una búsqueda de usuarios con rol `profesional`, conviene un selector en lugar de pedir el ID a mano.

---

## 7. Limitaciones actuales

| Limitación | Impacto en el frontend |
|---|---|
| **`PATCH /api/reservas/:id` todavía no está habilitado en la base.** | Hasta que se habilite responde `500`. *Pendiente en el backend.* |
| No hay rutas para editar o desactivar servicios y profesionales, ni para asignar servicios a profesionales. | Esas tareas se hacen hoy directamente en la base de datos. |
| Las respuestas de `/api/turnos` traen solo `profesional_id` y `servicio_id` (`/api/reservas` sí incluye los nombres). | Para mostrar nombres en la selección de horarios, cruzar con `/api/profesionales` y `/api/servicios` (se pueden pedir una vez y guardar en memoria). |
| "Mis turnos" muestra solo las reservas desde hoy. | No hay historial de turnos pasados. |
