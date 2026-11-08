"""Capa de datos: esquema, migraciones idempotentes y semilla de demo.

Diseño según DOCUMENTO-TECNICO-GESTION.md (v2): PostgreSQL+PostGIS en producción
real; SQLite/WAL para MVP y demo. Las migraciones son aditivas y se aplican al
arrancar, de modo que una base existente no se pierde.
"""
from __future__ import annotations

import hashlib
import sqlite3
import uuid
import time
import uuid
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "app.db"

# ---------------------------------------------------------------- conexión
def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA busy_timeout=30000")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def hash_pw(password: str) -> str:
    """SHA-256 con sal por usuario (suficiente para MVP; argon2 en producción)."""
    return hashlib.sha256(password.encode()).hexdigest()


def hash_pw_salted(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


# ---------------------------------------------------------------- esquema
SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios(
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, zona TEXT NOT NULL,
    telefono TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'vecino',
    yape TEXT, descripcion TEXT DEFAULT '', oficios TEXT DEFAULT '',
    telefono_verificado INTEGER DEFAULT 0, acepta_privacidad INTEGER DEFAULT 0,
    creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS codigos_telefono(
    telefono TEXT PRIMARY KEY, codigo TEXT NOT NULL, proposito TEXT NOT NULL,
    expira INTEGER NOT NULL, intentos INTEGER DEFAULT 0, creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sesiones(
    token TEXT PRIMARY KEY, usuario_id TEXT NOT NULL,
    creado INTEGER NOT NULL, expira INTEGER NOT NULL,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS publicaciones(
    id TEXT PRIMARY KEY, autor_id TEXT NOT NULL,
    tipo TEXT NOT NULL, categoria TEXT NOT NULL, subtipo_favor TEXT,
    titulo TEXT NOT NULL, descripcion TEXT NOT NULL,
    precio TEXT DEFAULT '', medios_pago TEXT DEFAULT '', qr_yape TEXT DEFAULT '',
    politica_pago TEXT DEFAULT 'contra_entrega',
    zona TEXT NOT NULL, lat REAL, lng REAL,
    punto_encuentro TEXT DEFAULT '', franja_horaria TEXT DEFAULT '',
    cupo INTEGER, checklist_ok INTEGER DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'activa', es_emergencia INTEGER DEFAULT 0,
    recurso_critico INTEGER DEFAULT 0,
    expira_en INTEGER, version INTEGER DEFAULT 0,
    creado INTEGER NOT NULL, actualizado INTEGER NOT NULL,
    client_id TEXT UNIQUE,
    deleted_at INTEGER, deleted_por TEXT, motivo_baja TEXT,
    FOREIGN KEY(autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS vistos(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL, usuario_id TEXT NOT NULL,
    comentario TEXT DEFAULT '', creado INTEGER NOT NULL,
    UNIQUE(publicacion_id, usuario_id),
    FOREIGN KEY(publicacion_id) REFERENCES publicaciones(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reportes(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL, motivo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    accion TEXT, moderado_por TEXT, moderado_en INTEGER, nota TEXT,
    creado INTEGER NOT NULL,
    UNIQUE(publicacion_id, usuario_id)
);
CREATE TABLE IF NOT EXISTS config_emergencia(
    id TEXT PRIMARY KEY, activa INTEGER NOT NULL DEFAULT 0,
    activada_por TEXT, activada_en INTEGER, desactivada_en INTEGER,
    motivo TEXT DEFAULT '', expira INTEGER
);
CREATE TABLE IF NOT EXISTS intercambios(
    id TEXT PRIMARY KEY, peticion_id TEXT NOT NULL, oferta_id TEXT,
    solicitante_id TEXT NOT NULL, ofertante_id TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'solicitada',
    garante_nombre TEXT DEFAULT '', fecha_devolucion TEXT DEFAULT '',
    foto_estado TEXT DEFAULT '', mensaje TEXT DEFAULT '',
    resuelto_por TEXT, resuelto_en INTEGER,
    creado INTEGER NOT NULL, actualizado INTEGER NOT NULL,
    UNIQUE(peticion_id, ofertante_id)
);
CREATE TABLE IF NOT EXISTS cotizaciones(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL, comprador_id TEXT NOT NULL,
    descripcion TEXT NOT NULL, medida TEXT DEFAULT '', urgencia TEXT DEFAULT 'normal',
    estado TEXT NOT NULL DEFAULT 'enviada', precio_respuesta TEXT DEFAULT '',
    nota_vendedor TEXT DEFAULT '', creado INTEGER NOT NULL, expira INTEGER NOT NULL,
    UNIQUE(publicacion_id, comprador_id, estado)
);
CREATE TABLE IF NOT EXISTS avaladores(
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL,
    tipo TEXT NOT NULL, zona TEXT NOT NULL, contacto TEXT DEFAULT '',
    verificado_por TEXT, verificado_en INTEGER, expira_en INTEGER,
    activo INTEGER DEFAULT 1, creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS publicacion_avalador(
    publicacion_id TEXT NOT NULL, avalador_id TEXT NOT NULL,
    PRIMARY KEY(publicacion_id, avalador_id)
);
CREATE TABLE IF NOT EXISTS eventos(
    id TEXT PRIMARY KEY, tipo TEXT NOT NULL, publicacion_id TEXT,
    usuario_id TEXT, meta TEXT DEFAULT '', creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tratos(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL,
    comprador_id TEXT NOT NULL, vendedor_id TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'acordado',
    monto TEXT DEFAULT '', nota TEXT DEFAULT '',
    marca_comprador INTEGER DEFAULT 0, marca_vendedor INTEGER DEFAULT 0,
    creado INTEGER NOT NULL, actualizado INTEGER NOT NULL,
    cerrado_en INTEGER,
    UNIQUE(publicacion_id, comprador_id, estado)
);
CREATE TABLE IF NOT EXISTS notificaciones(
    id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL, titulo TEXT NOT NULL, cuerpo TEXT DEFAULT '',
    enlace TEXT DEFAULT '', leida INTEGER DEFAULT 0, creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS accesos_contacto(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL, usuario_id TEXT NOT NULL,
    creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS historial_estado(
    id TEXT PRIMARY KEY, entidad TEXT NOT NULL, entidad_id TEXT NOT NULL,
    estado_anterior TEXT, estado_nuevo TEXT, actor_id TEXT,
    motivo TEXT DEFAULT '', creado INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pub_estado ON publicaciones(estado, creado DESC);
CREATE INDEX IF NOT EXISTS ix_pub_tipo ON publicaciones(tipo, categoria, zona);
CREATE INDEX IF NOT EXISTS ix_pub_autor ON publicaciones(autor_id);
CREATE INDEX IF NOT EXISTS ix_rep_estado ON reportes(estado);
CREATE INDEX IF NOT EXISTS ix_eventos_tipo ON eventos(tipo, creado DESC);
CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS ix_cot_pub ON cotizaciones(publicacion_id, estado);
CREATE INDEX IF NOT EXISTS ix_tratos_pub ON tratos(publicacion_id, comprador_id);
CREATE INDEX IF NOT EXISTS ix_notif_user ON notificaciones(usuario_id, leida, creado DESC);
CREATE INDEX IF NOT EXISTS ix_accesos_pub ON accesos_contacto(publicacion_id, creado DESC);
"""

# Columnas añadidas después de la primera versión (migración aditiva)
MIGRATIONS = {
    "usuarios": {
        "descripcion": "TEXT DEFAULT ''",
        "oficios": "TEXT DEFAULT ''",
        "telefono_verificado": "INTEGER DEFAULT 0",
        "acepta_privacidad": "INTEGER DEFAULT 0",
        "salt": "TEXT DEFAULT ''",
        "plin": "TEXT DEFAULT ''",
        "mostrar_contacto": "INTEGER DEFAULT 1",
        "reset_code": "TEXT DEFAULT ''",
        "reset_expira": "INTEGER",
        "intentos_fallidos": "INTEGER DEFAULT 0",
        "bloqueado_hasta": "INTEGER",
        "pin_hash": "TEXT DEFAULT ''",
        "pin_salt": "TEXT DEFAULT ''",
    },
    "publicaciones": {
        "subtipo_favor": "TEXT",
        "medios_pago": "TEXT DEFAULT ''",
        "qr_yape": "TEXT DEFAULT ''",
        "politica_pago": "TEXT DEFAULT 'contra_entrega'",
        "punto_encuentro": "TEXT DEFAULT ''",
        "franja_horaria": "TEXT DEFAULT ''",
        "cupo": "INTEGER",
        "checklist_ok": "INTEGER DEFAULT 0",
        "recurso_critico": "INTEGER DEFAULT 0",
        "expira_en": "INTEGER",
        "version": "INTEGER DEFAULT 0",
        "actualizado": "INTEGER DEFAULT 0",
        "deleted_at": "INTEGER",
        "deleted_por": "TEXT",
        "motivo_baja": "TEXT",
        "yape_snapshot": "TEXT DEFAULT ''",
        "plin_snapshot": "TEXT DEFAULT ''",
        "mostrar_contacto": "INTEGER DEFAULT 1",
        "fotos": "TEXT DEFAULT ''",
        "necesidad": "TEXT DEFAULT ''",
    },
    "sesiones": {"expira": "INTEGER DEFAULT 0"},
    "reportes": {
        "estado": "TEXT DEFAULT 'pendiente'",
        "accion": "TEXT",
        "moderado_por": "TEXT",
        "moderado_en": "INTEGER",
        "nota": "TEXT",
    },
    "config_emergencia": {"desactivada_en": "INTEGER", "expira": "INTEGER"},
}


def _columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {r["name"] for r in con.execute(f"PRAGMA table_info({table})")}


def migrate(con: sqlite3.Connection) -> list[str]:
    applied: list[str] = []
    for table, cols in MIGRATIONS.items():
        try:
            existing = _columns(con, table)
        except sqlite3.Error:
            continue
        for col, decl in cols.items():
            if col not in existing:
                con.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
                applied.append(f"{table}.{col}")
    con.commit()
    return applied


DEMO_PIN = "123456"

SEED_USERS = [
    ("u-mod", "María Panta", "Piura Centro", "999000001", "mod@app.local", "mod123", "moderador", "999000001"),
    ("u-gas", "Juan Quispe", "Piura Centro", "999000002", "juan@app.local", "gas123", "vecino", "999000002"),
    ("u-carp", "Ana Morales", "Urb. Miraflores (Castilla)", "999000003", "ana@app.local", "carp123", "vecino", "999000003"),
    ("u-vec", "Pedro Chunga", "Piura Centro", "999000004", "pedro@app.local", "pedro123", "vecino", None),
    ("u-vec2", "Lucía Yarlequé", "Urb. Santa Isabel", "999000005", "lucia@app.local", "lucia123", "vecino", "999000005"),
    # Moderador suplente: si el titular no está, la moderación y la emergencia siguen
    ("u-mod2", "Rosa Huamán", "Piura Centro", "999000006", "mod2@app.local", "mod2-123", "moderador", "999000006"),
]

# Centros de sector (misma lista que app/main.py) para ubicar la semilla.
ZONA_CENTRO = {
    "Piura Centro": (-5.19449, -80.63282),
    "Urb. Miraflores (Castilla)": (-5.18520, -80.62140),
    "Urb. Santa Isabel": (-5.18680, -80.63650),
    "Urb. Ignacio Merino": (-5.17850, -80.64210),
    "Veintiséis de Octubre": (-5.19830, -80.66120),
    "Urb. Los Ejidos": (-5.16240, -80.63190),
    "Urb. El Chipe": (-5.17420, -80.62580),
    "Catacaos Centro": (-5.26670, -80.68330),
}

SEED_PUBS = [
    # id, autor, tipo, categoria, subtipo, titulo, desc, precio, medios, zona, lat, lng, emergencia
    ("p1", "u-gas", "servicio", "gasfitería", None,
     "Gasfitero 24h · fugas, tanques y electrobombas",
     "Destapes, instalación de caños y reparación de fugas. Atención el mismo día en Piura Centro, "
     "Santa Isabel y Miraflores. Presupuesto sin costo antes de empezar.",
     "A convenir", "yape,efectivo", "Piura Centro", -5.19449, -80.63282, 0),
    ("p2", "u-carp", "servicio", "carpintería", None,
     "Carpintería a medida en Castilla",
     "Puertas, mesas y closets con medidas exactas. Taller en Miraflores (Castilla). "
     "Acepto intercambio por clases o trabajo de gasfitería.",
     "Intercambio / sin dinero", "intercambio", "Urb. Miraflores (Castilla)", -5.18520, -80.62140, 0),
    ("p3", "u-vec", "producto", "alimentos", None,
     "Pastelitos piuranos por encargo",
     "Pastelitos dulces y salados, receta de casa. Pedidos con un día de anticipación. "
     "Entrego en la Plaza de Armas o en la puerta de tu casa dentro de Piura Centro.",
     "S/ 2.00", "yape,efectivo", "Piura Centro", -5.19400, -80.63300, 0),
    ("p4", "u-vec", "favor_solicitado", "préstamo", "prestamo",
     "Necesito una muleta por una semana",
     "Me lesioné la pierna jugando fútbol y necesito una muleta hasta el viernes. "
     "La devuelvo en el mismo estado, con garante del barrio.",
     "Intercambio / sin dinero", "intercambio", "Piura Centro", -5.19480, -80.63200, 0),
    ("p5", "u-vec2", "favor_ofrecido", "movilidad", "movilidad",
     "Comparto auto hacia el colegio · Santa Isabel",
     "Salgo 7:00 de Santa Isabel hacia la zona de colegios. Punto de encuentro: parque del sector. "
     "Sin pago, cupo para dos personas adultas.",
     "Intercambio / sin dinero", "intercambio", "Urb. Santa Isabel", -5.18680, -80.63650, 0),
    ("p6", "u-gas", "servicio", "electricidad", None,
     "Electricista · instalaciones y urgencias",
     "Instalaciones, cambio de tableros y urgencias eléctricas, también durante emergencias "
     "por lluvia o corte de luz.",
     "A convenir", "yape,efectivo", "Piura Centro", -5.19600, -80.63400, 1),
    ("p7", "u-carp", "favor_solicitado", "herramientas", "prestamo",
     "Necesito un taladro el fin de semana",
     "Para colgar cuadros en casa. Lo devuelvo el domingo por la tarde.",
     "Intercambio / sin dinero", "intercambio", "Urb. Miraflores (Castilla)", -5.18600, -80.62200, 0),
    ("p8", "u-vec2", "producto", "alimentos", None,
     "Lasaña casera por encargo (Lucía)",
     "Lasaña de carne para cuatro personas, pedidos con un día de anticipación. "
     "Muy pedida en Santa Isabel.",
     "S/ 25.00", "yape,efectivo", "Urb. Santa Isabel", -5.18700, -80.63700, 0),
    ("p9", "u-vec2", "servicio", "clases", None,
     "Clases de matemática para primaria y secundaria",
     "Refuerzo escolar por hora, en tu casa o en la biblioteca del sector. Acepto intercambio.",
     "S/ 15.00", "yape,efectivo,intercambio", "Urb. Santa Isabel", -5.18750, -80.63600, 0),
    ("p10", "u-carp", "producto", "alimentos", None,
     "Tortas y queques por encargo (Ana)",
     "Tortas de chocolate y queques de naranja, pedidos con dos días de anticipación.",
     "S/ 30.00", "yape,efectivo", "Urb. Miraflores (Castilla)", -5.18450, -80.62050, 0),
    ("p11", "u-gas", "servicio", "gasfitería", None,
     "Limpieza de tanque y cisterna",
     "Limpieza y desinfección de tanques elevados y cisternas, con certificado simple de trabajo.",
     "S/ 80.00", "yape,efectivo", "Veintiséis de Octubre", -5.19830, -80.66120, 0),
    ("p12", "u-vec", "favor_ofrecido", "ayuda_temporal", "ayuda_temporal",
     "Ayudo a mover muebles dentro del sector",
     "Tengo camioneta y puedo ayudar a mover muebles o materiales dentro de Piura Centro. Sin cobro.",
     "Intercambio / sin dinero", "intercambio", "Piura Centro", -5.19350, -80.63150, 0),
    ("p13", "u-carp", "servicio", "cerrajería", None,
     "Cerrajería: apertura sin daño y cambio de chapa",
     "Apertura de puertas sin romper, cambio de chapas y candados. Atiendo Miraflores y Castilla.",
     "S/ 40.00", "yape,efectivo", "Urb. Miraflores (Castilla)", -5.18560, -80.62100, 0),
    ("p14", "u-vec2", "producto", "alimentos", None,
     "Almuerzos caseros de lunes a viernes",
     "Menú del día con sopa, segundo y refresco. Entrega en Santa Isabel entre 12 y 1.",
     "S/ 8.00", "yape,efectivo", "Urb. Santa Isabel", -5.18650, -80.63680, 0),
    ("p15", "u-vec2", "servicio", "paseo de mascotas", None,
     "Paseo de perros por Santa Isabel",
     "Paseo tu perro 30 minutos por la mañana o al atardecer, dentro del sector. "
     "Acepto también trueque por almuerzos.",
     "S/ 10.00", "yape,efectivo,intercambio", "Urb. Santa Isabel", -5.18690, -80.63580, 0),
    ("p16", "u-gas", "servicio", "electricidad", None,
     "Instalación de luminarias y tomacorrientes",
     "Cambio de tomacorrientes, instalación de luces y revisión de tablero. "
     "Materiales aparte o los coordinas tú.",
     "S/ 45.00", "yape,efectivo", "Urb. Ignacio Merino", -5.17850, -80.64210, 0),
    ("p17", "u-carp", "producto", "herramientas", None,
     "Cajones de madera para cocina por encargo",
     "Cajones y repisas de madera a medida, entrega en una semana.",
     "S/ 120.00", "yape,efectivo", "Urb. Miraflores (Castilla)", -5.18490, -80.62080, 0),
    ("p18", "u-vec", "producto", "alimentos", None,
     "Chifles y camotes fritos por bolsa",
     "Bolsa de 250 g, hechos el mismo día. Entrega en Piura Centro.",
     "S/ 6.00", "yape,efectivo", "Piura Centro", -5.19320, -80.63220, 0),
    ("p19", "u-vec2", "favor_ofrecido", "donacion", "donacion",
     "Dono ropa de niño talla 4 a 8",
     "Ropa en buen estado, lavada. Retiro en Santa Isabel, sin costo.",
     "Intercambio / sin dinero", "intercambio", "Urb. Santa Isabel", -5.18720, -80.63720, 0),
    ("p20", "u-gas", "favor_solicitado", "herramientas", "prestamo",
     "Busco escalera de tijera para pintar",
     "Una tarde nada más. La devuelvo limpia y con garante del barrio.",
     "Intercambio / sin dinero", "intercambio", "Piura Centro", -5.19520, -80.63080, 0),
    ("p21", "u-carp", "servicio", "clases", None,
     "Clases de dibujo técnico para secundaria",
     "Clases por hora, en la biblioteca del sector. Preparación para exámenes.",
     "S/ 20.00", "yape,efectivo", "Urb. Miraflores (Castilla)", -5.18590, -80.62280, 0),
    ("p22", "u-vec2", "servicio", "cerrajería", None,
     "Cambio de chapa y copia de llaves",
     "Cambio de chapa de puerta principal y copias. Atiendo Santa Isabel y Centro.",
     "S/ 35.00", "yape,efectivo", "Urb. Santa Isabel", -5.18760, -80.63620, 0),
    ("p23", "u-gas", "producto", "alimentos", None,
     "Agua de mesa en bidón de 20 L",
     "Bidón sellado entregado en casa, dentro de Piura Centro y 26 de Octubre.",
     "S/ 5.00", "yape,efectivo", "Veintiséis de Octubre", -5.19790, -80.66010, 0),
    ("p24", "u-vec", "favor_solicitado", "ayuda_temporal", "ayuda_temporal",
     "Ayuda para limpiar el techo antes de las lluvias",
     "Necesito una mano el sábado por la mañana para limpiar canaletas. Doy almuerzo.",
     "Intercambio / sin dinero", "intercambio", "Piura Centro", -5.19420, -80.63420, 0),
    ("p25", "u-carp", "servicio", "gasfitería", None,
     "Reparación de tanque elevado con fuga",
     "Sello de fugas en tanques elevados y cisternas. Trabajo garantizado 30 días.",
     "S/ 90.00", "yape,efectivo", "Urb. Los Ejidos", -5.16240, -80.63190, 0),
    ("p26", "u-vec2", "producto", "alimentos", None,
     "Queso fresco artesanal por kilo",
     "Queso fresco de vaca, hecho en casa. Pedidos los jueves.",
     "S/ 22.00", "yape,efectivo", "Urb. El Chipe", -5.17420, -80.62580, 0),
    ("p27", "u-gas", "servicio", "carpintería", None,
     "Reparación de puertas y cerraduras",
     "Ajuste de puertas que rozan, cambio de bisagras y cerraduras.",
     "S/ 50.00", "yape,efectivo", "Catacaos Centro", -5.26670, -80.68330, 0),
    ("p28", "u-carp", "favor_ofrecido", "intercambio_habilidades", "intercambio_habilidades",
     "Enseño a hacer muebles simples a cambio de ayuda",
     "Te enseño a armar una repisa o un banco con madera reciclada; a cambio me ayudas "
     "dos tardes en el taller.",
     "Intercambio / sin dinero", "intercambio", "Urb. Miraflores (Castilla)", -5.18500, -80.62190, 0),
    ("p29", "u-vec", "servicio", "electricidad", None,
     "Revisión de instalación eléctrica antes de lluvias",
     "Reviso tablero, pozos de tierra y cableado expuesto. Informe simple por escrito.",
     "S/ 60.00", "yape,efectivo", "Urb. Los Ejidos", -5.16310, -80.63260, 0),
    ("p30", "u-vec2", "favor_solicitado", "movilidad", "movilidad",
     "Traslado solidario al hospital para mi mamá",
     "Necesito traslado al hospital el martes a las 8. Punto de encuentro: parque del sector. "
     "No pago, ofrezco almuerzo a cambio.",
     "Intercambio / sin dinero", "intercambio", "Urb. Santa Isabel", -5.18640, -80.63710, 0),
]

SEED_VISTOS = [
    ("v1", "p1", "u-vec", "Arregló una fuga en menos de una hora."),
    ("v2", "p1", "u-vec2", "Puntual y cobró lo acordado."),
    ("v3", "p3", "u-gas", "Los pastelitos son ricos, los recomiendo."),
    ("v4", "p8", "u-vec", "La lasaña de la vecina es muy buena."),
    ("v5", "p2", "u-vec", "Trabajo prolijo y a buen precio."),
]

SEED_AVALADORES = [
    ("av1", "Ferretería El Tornillo", "ferreteria", "Piura Centro", "999111001"),
    ("av2", "Bodega Doña Rosa", "bodega", "Urb. Miraflores (Castilla)", "999111002"),
    ("av3", "Olla Común San Martín", "olla", "Urb. Santa Isabel", "999111003"),
    ("av4", "Parroquia San José", "parroquia", "Piura Centro", "999111004"),
]


def seed(con: sqlite3.Connection) -> None:
    now = int(time.time())
    for uid, nombre, zona, tel, email, pw, rol, yape in SEED_USERS:
        con.execute(
            "INSERT OR IGNORE INTO usuarios(id,nombre,zona,telefono,email,pass,rol,yape,creado,telefono_verificado,acepta_privacidad)"
            " VALUES(?,?,?,?,?,?,?,?,?,1,1)",
            (uid, nombre, zona, tel, email, hash_pw(pw), rol, yape, now),
        )
    # Las cuentas de demostración entran con teléfono y PIN (6 dígitos).
    # En producción cada persona define el suyo al verificar su número.
    for uid, *_ in SEED_USERS:
        fila = con.execute("SELECT pin_salt FROM usuarios WHERE id=?", (uid,)).fetchone()
        if fila is not None and not (fila["pin_salt"] or ""):
            sal = uuid.uuid4().hex[:16]
            con.execute("UPDATE usuarios SET pin_hash=?, pin_salt=? WHERE id=?",
                        (hash_pw_salted(DEMO_PIN, sal), sal, uid))
    con.commit()

    for pid, autor, tipo, cat, sub, tit, desc, precio, medios, zona, lat, lng, em in SEED_PUBS:
        # Separar las ofertas del centro exacto del sector (~150-400 m), para que
        # la lista no muestre todo a la misma distancia: el barrio no es un punto.
        centro = ZONA_CENTRO.get(zona)
        if centro and abs(lat - centro[0]) < 0.0005 and abs(lng - centro[1]) < 0.0005:
            h = sum(ord(c) for c in pid)
            lat += ((h % 7) - 3) * 0.0009
            lng += ((h // 7 % 7) - 3) * 0.0009
        con.execute(
            "INSERT OR IGNORE INTO publicaciones(id,autor_id,tipo,categoria,subtipo_favor,titulo,descripcion,"
            "precio,medios_pago,zona,lat,lng,estado,es_emergencia,creado,actualizado,client_id,expira_en)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'activa',?,?,?,?,?)",
            (pid, autor, tipo, cat, sub, tit, desc, precio, medios, zona, lat, lng, em, now, now, pid,
             now + 30 * 86400),
        )
    for vid, pid, uid, com in SEED_VISTOS:
        con.execute(
            "INSERT OR IGNORE INTO vistos(id,publicacion_id,usuario_id,comentario,creado) VALUES(?,?,?,?,?)",
            (vid, pid, uid, com, now),
        )
    for aid, nombre, tipo, zona, contacto in SEED_AVALADORES:
        con.execute(
            "INSERT OR IGNORE INTO avaladores(id,nombre,tipo,zona,contacto,verificado_por,verificado_en,expira_en,activo,creado)"
            " VALUES(?,?,?,?,?,'u-mod',?,?,1,?)",
            (aid, nombre, tipo, zona, contacto, now, now + 365 * 86400, now),
        )
    con.execute(
        "INSERT OR IGNORE INTO publicacion_avalador(publicacion_id,avalador_id)"
        " VALUES('p1','av1'),('p3','av2'),('p8','av3')"
    )
    # Fila única de configuración de emergencia (sin ella la activación no persiste)
    con.execute(
        "INSERT OR IGNORE INTO config_emergencia(id,activa,activada_por,activada_en,desactivada_en,motivo,expira)"
        " VALUES('global',0,NULL,NULL,NULL,'',NULL)"
    )
    con.commit()


def init_db() -> list[str]:
    con = connect()
    con.executescript(SCHEMA)
    applied = migrate(con)
    seed(con)
    con.close()
    return applied


if __name__ == "__main__":
    print("Esquema y migraciones:", init_db() or "sin cambios")
    print("Base:", DB_PATH)
