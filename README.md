# API de Turnos – Estética

Backend REST para gestionar turnos de un centro de estética: servicios, profesionales, la relación entre ambos y la generación y reserva de franjas horarias.

Construido con **Node.js + Express 5**, con persistencia en **Supabase (PostgreSQL)**. Se despliega en **Vercel**.

---

## Índice

- [Stack](#stack)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Autenticación](#autenticación)
- [Endpoints](#endpoints)
- [Reglas de generación de turnos](#reglas-de-generación-de-turnos)
- [Modelo de datos](#modelo-de-datos)
- [Flujos documentados](#flujos-documentados)
- [Estado del proyecto](#estado-del-proyecto)

---

## Stack

| Componente | Tecnología |
|---|---|
| Runtime | Node.js 24.x |
| Framework HTTP | Express 5 |
| Base de datos | Supabase (PostgreSQL) vía `@supabase/supabase-js` |
| Configuración | `dotenv` |
| CORS | `cors` |
| Deploy | Vercel (`@vercel/node`) |

## Estructura del proyecto

```
.
├── package.json
└── src/
    ├── server.js                 # Punto de entrada: levanta el servidor HTTP
    ├── app.js                    # Configuración de Express, middlewares y rutas
    ├── vercel.json               # Configuración de despliegue en Vercel
    ├── config/
    │   └── supabase.js           # Cliente de Supabase
    ├── routes/                   # Definición de endpoints por recurso
    ├── controllers/              # Manejo de request/response de cada endpoint
    ├── services/                 # Lógica de negocio (reservas, alta de profesional)
    │                             # y cliente de la API de Usuarios
    ├── utils/
    │   └── fechas.js             # Fecha de hoy en la zona horaria del centro
    ├── middlewares/
    │   ├── loggerMiddleware.js   # Log de método y URL de cada request
    │   ├── authMiddleware.js     # Verificación de JWT y control de roles
    │   ├── validateMiddleware.js # Validación de formato del body
    │   └── errorMiddleware.js    # Manejo centralizado de errores
    └── docs/
        ├── database/
        │   ├── DER turnos.jpeg        # Diagrama entidad-relación
        │   └── 001_reservas.sql       # Restricciones y función modificar_reserva
        └── diagrams/*.puml            # Diagramas de secuencia (PlantUML)
```

## Puesta en marcha

Requisitos: Node.js 24.x y un proyecto de Supabase con las tablas del [modelo de datos](#modelo-de-datos).

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo .env en la raíz (ver sección siguiente)

# 3. Iniciar el servidor
npm start
```

Además, hay que ejecutar una vez en el SQL Editor de Supabase el script [`src/docs/database/001_reservas.sql`](src/docs/database/001_reservas.sql). El script hace cuatro cosas:
- Ajusta el esquema: `usuario_id` pasa a texto, se agrega `PROFESIONAL.usuario_id` y se corrige el nombre de `especialidad`.
- Borra los servicios de prueba, los que no duran 60 minutos.
- Crea las restricciones de integridad.
- Crea la función `modificar_reserva`, que usa `PATCH /api/reservas/:id`.

Corre en una transacción y se puede volver a ejecutar sin problemas.

El servidor queda disponible en `http://localhost:3001` (o en el puerto definido en `PORT`). Para verificar que funciona:

```bash
curl http://localhost:3001/
# API de Turnos de Estética funcionando correctamente
```

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto (está excluido del repositorio por `.gitignore`):

```env
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_KEY=<clave de Supabase>
JWT_SECRET=<mismo secreto con el que firma la API de Usuarios>
USUARIOS_API_URL=https://<api-de-usuarios>
API_KEY_INTERNA=<clave compartida con la API de Usuarios>
PORT=3001
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `SUPABASE_URL` | Sí | URL del proyecto de Supabase |
| `SUPABASE_KEY` | Sí | Clave de acceso a Supabase. Si falta alguna de las dos, la app no arranca. |
| `JWT_SECRET` | Sí, para endpoints protegidos | Secreto para verificar los JWT emitidos por la API de Usuarios. Si falta, los endpoints protegidos responden `500`. |
| `USUARIOS_API_URL` | Sí, para el alta de profesionales | URL base de la API de Usuarios. |
| `API_KEY_INTERNA` | Sí, para el alta de profesionales | Clave enviada en `X-API-Key` al consultar la API de Usuarios. |
| `PORT` | No | Puerto HTTP. Por defecto `3001`. |

## Autenticación

Los endpoints protegidos esperan un JWT emitido por la API de Usuarios:

```
Authorization: Bearer <JWT>
```

La API verifica la firma (HS256) y la expiración localmente, sin llamar a la API de Usuarios. El payload debe incluir `id` (el ObjectId del usuario en MongoDB) y `rol`.

| Código | Cuándo |
|---|---|
| `401` | Falta el token, la firma no es válida o está vencido. |
| `403` | El token es válido pero el rol no tiene permiso. |

## Endpoints

Todas las rutas cuelgan de `/api`. Las respuestas son JSON.

### Servicios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/servicios` | Lista los servicios activos (`activo = true`). |

### Profesionales

| Método | Ruta | Autorización | Descripción |
|---|---|---|---|
| `GET` | `/api/profesionales` | — | Lista los profesionales activos (`activo = true`), cada uno con los servicios activos que ofrece. |
| `POST` | `/api/profesionales` | JWT con rol `administrador` | Da de alta un profesional a partir de un usuario de la API de Usuarios. |

**`GET /api/profesionales`**: cada profesional incluye `servicios`, resuelto internamente a partir de `PROFESIONAL_SERVICIO` (la relación no se expone como ruta). Filtro opcional por query string; si tiene formato incorrecto, responde `400`.

| Parámetro | Ejemplo | Descripción |
|---|---|---|
| `servicio_id` | `2` | Solo profesionales que ofrecen ese servicio. |

**`POST /api/profesionales`**

```json
{
  "usuario_id": "665f1c2e9a1b2c3d4e5f6a7b",
  "especialidad": "Cosmetología"
}
```

La API consulta a la API de Usuarios (`GET /interno/usuarios/{usuario_id}` con `X-API-Key`) y toma de ahí el nombre y el apellido.

| Código | Cuándo |
|---|---|
| `201` | Profesional creado. Devuelve el profesional creado. |
| `400` | `usuario_id` o `especialidad` vacíos o con formato incorrecto. |
| `401` / `403` | Ver [Autenticación](#autenticación). |
| `404` | El usuario no existe en la API de Usuarios. |
| `409` | El usuario ya está dado de alta como profesional. |
| `422` | El usuario no tiene rol `profesional` o no está activo. |
| `500` | Error de base de datos, o la API de Usuarios no responde. |

### Turnos

| Método | Ruta | Autorización | Descripción |
|---|---|---|---|
| `GET` | `/api/turnos` | — | Lista los turnos con estado `disponible` desde hoy, ordenados por fecha y hora de inicio. |
| `POST` | `/api/turnos/generar` | JWT con rol `administrador` | Genera las franjas disponibles de un día para un servicio. |

**`GET /api/turnos`**: filtros opcionales por query string. Si alguno tiene formato incorrecto, responde `400`.

| Parámetro | Ejemplo | Descripción |
|---|---|---|
| `fecha` | `2026-11-03` | Solo franjas de ese día. |
| `profesional_id` | `3` | Solo franjas de ese profesional. |
| `servicio_id` | `1` | Solo franjas de profesionales que ofrecen ese servicio. |

```
GET /api/turnos?servicio_id=1&fecha=2026-11-03
```

**`POST /api/turnos/generar`**

```json
{
  "fecha": "2026-11-03",
  "servicio_id": 1
}
```

`fecha` debe tener formato `YYYY-MM-DD` y ser una fecha válida. `servicio_id` debe ser un entero positivo (número, no string).

| Código | Cuándo |
|---|---|
| `201` | Se generaron turnos. Devuelve la lista de turnos generados. |
| `200` | No hay profesionales habilitados para el servicio, o no quedan horarios libres para generar. |
| `400` | Formato de `fecha` o `servicio_id` incorrecto, JSON mal formado, la fecha cae en fin de semana o la duración del servicio no es válida. |
| `401` / `403` | Ver [Autenticación](#autenticación). |
| `404` | El servicio no existe o está inactivo. |
| `500` | Error de base de datos o interno. |

### Reservas

Todas requieren un JWT de usuario. El `usuario_id` se toma del token, nunca del body.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/reservas` | Lista las reservas vigentes (desde hoy) del usuario, con los datos del servicio y del profesional. |
| `POST` | `/api/reservas` | Reserva una franja disponible para un servicio. |
| `PATCH` | `/api/reservas/:id` | Cambia una reserva propia a otra franja del mismo profesional. |
| `DELETE` | `/api/reservas/:id` | Cancela una reserva propia. La franja vuelve a quedar disponible. |

**`POST /api/reservas`**

```json
{
  "turno_id": 15,
  "servicio_id": 1
}
```

| Código | Cuándo |
|---|---|
| `201` | Franja reservada. Devuelve el Turno reservado. |
| `400` | `turno_id` o `servicio_id` con formato incorrecto. |
| `401` | Ver [Autenticación](#autenticación). |
| `404` | La franja no existe, no está disponible o es de una fecha pasada. |
| `409` | Otro usuario reservó la franja al mismo tiempo. |
| `422` | El profesional de la franja no ofrece ese servicio. |

**`PATCH /api/reservas/:id`**: `:id` es el turno reservado actualmente.

```json
{
  "nuevo_turno_id": 18
}
```

La reserva de la nueva franja y la liberación de la anterior se hacen en una sola transacción, con la función `modificar_reserva`. Si algo falla, no cambia nada.

| Código | Cuándo |
|---|---|
| `200` | Reserva modificada. Devuelve el Turno de la nueva franja. |
| `400` | Formato incorrecto, o `nuevo_turno_id` es igual a `:id`. |
| `401` | Ver [Autenticación](#autenticación). |
| `404` | La reserva no existe o no pertenece al usuario. |
| `409` | La nueva franja no está disponible, es de otro profesional o es de una fecha pasada. |

**`DELETE /api/reservas/:id`**

| Código | Cuándo |
|---|---|
| `200` | Reserva cancelada. Devuelve el Turno liberado. |
| `400` | `:id` con formato incorrecto. |
| `401` | Ver [Autenticación](#autenticación). |
| `404` | La reserva no existe o no pertenece al usuario. |

### Formato de error

```json
{
  "mensaje": "Descripción del error",
  "error": "Detalle técnico (cuando aplica)"
}
```

## Reglas de generación de turnos

`POST /api/turnos/generar` aplica estas reglas:

1. **Días hábiles**: solo de lunes a viernes.
2. **Horario**: de 09:00 a 18:00. Una franja se genera solo si termina dentro de la jornada.
3. **Duración**: cada franja dura lo que indica `SERVICIO.duracion` (en minutos, entre 1 y 480). Hoy todos los servicios duran 60 minutos, así que las franjas son de una hora y cualquier servicio del profesional entra en cualquiera de sus franjas.
4. **Profesionales**: se generan franjas para cada profesional con una relación activa en `PROFESIONAL_SERVICIO` para ese servicio.
5. **Sin superposición**: no se crea una franja si se superpone con cualquier turno ya existente del mismo profesional en esa fecha, sin importar el servicio.
6. Las franjas se crean con `estado = 'disponible'`, `usuario_id = null` y `servicio_id = null`. El servicio se asigna recién al reservar.

## Modelo de datos

![DER](src/docs/database/DER%20turnos.jpeg)

| Tabla | Descripción |
|---|---|
| `SERVICIO` | Servicios ofrecidos: nombre, categoría, descripción, duración (min), precio y si está activo. |
| `PROFESIONAL` | Profesionales del centro. `usuario_id` es una referencia lógica al servicio de Usuarios (otra base de datos). |
| `PROFESIONAL_SERVICIO` | Qué servicios ofrece cada profesional (N:M), con indicador `activo`. |
| `TURNO` | Franja horaria de un profesional: fecha, hora de inicio y fin, y estado. `servicio_id` y `usuario_id` quedan en `null` mientras está disponible. |

> **Diferencias entre el DER y la base** (después de ejecutar `001_reservas.sql`):
> - `PROFESIONAL.usuario_id` y `TURNO.usuario_id` son de tipo **texto**, no `int`, porque guardan el ObjectId de MongoDB de la API de Usuarios.
> - `PROFESIONAL` tiene además la columna `activo` (boolean).
> - Todos los servicios duran 60 minutos.

**Estados de un turno:** `disponible` → `reservado` (al reservar) → `disponible` (al cancelar).

## Flujos documentados

> Para el equipo de frontend hay una guía de integración en [`src/docs/API-frontend.md`](src/docs/API-frontend.md).

En [`src/docs/diagrams`](src/docs/diagrams) hay diagramas de secuencia en PlantUML que describen el comportamiento esperado de la API. Se pueden visualizar con la extensión PlantUML de VS Code o en [plantuml.com](https://www.plantuml.com/plantuml).

| Flujo | Endpoint | Autorización | Resumen |
|---|---|---|---|
| [Reserva de turno](src/docs/diagrams/Diagrama%20reserva%20turno.puml) | `POST /api/reservas` | JWT de usuario | Valida datos, verifica que la franja esté disponible y que el profesional ofrezca el servicio, y la reserva con un `UPDATE` condicional (`409` si otro usuario la tomó antes). |
| [Modificación de turno](src/docs/diagrams/Diagrama%20modificacion%20turno.puml) | `PATCH /api/reservas/:id` | JWT de usuario | Reserva una nueva franja del mismo profesional y libera la anterior. |
| [Cancelación de turno](src/docs/diagrams/Diagrama%20cancelacion%20turno.puml) | `DELETE /api/reservas/:id` | JWT de usuario | Vuelve la franja a `disponible` solo si pertenece al usuario. |
| [Alta de profesional](src/docs/diagrams/Diagrama%20registro%20profesional%20en%20turnos.puml) | `POST /api/profesionales` | JWT con rol `administrador` | Consulta la API de Usuarios (con `X-API-Key` interna) para validar que el usuario exista, esté activo y tenga rol `profesional`, y lo registra. |

En todos los flujos la API verifica el JWT localmente (firma y expiración) y responde `401` si no es válido.

**Diferencias con los diagramas:**
- Las rutas quedaron unificadas en `/api/reservas`. Los diagramas usan `/reservas` y `/reserva/{id}`.
- La modificación se ejecuta en una transacción (función `modificar_reserva`), en lugar de dos `UPDATE` sueltos.
- Se agregaron validaciones que los diagramas no muestran: no se puede reservar ni pasar a una franja de una fecha pasada, y en la modificación la nueva franja debe ser distinta de la actual (`400`).

## Estado del proyecto

**Implementado**

- Listado de servicios, profesionales, relaciones profesional–servicio y turnos disponibles.
- Generación de turnos disponibles por fecha y servicio (solo administradores).
- Logger de requests.
- Middlewares de autenticación JWT, control de roles, validación de formato y manejo centralizado de errores.
- Filtros por fecha, profesional y servicio en el listado de turnos.
- Consulta, reserva, modificación y cancelación de turnos.
- Alta de profesionales con integración a la API de Usuarios.

**Pendiente**

- Tests automatizados.
