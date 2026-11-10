"""Pruebas añadidas al aplicar ECC (ruff + tdd-workflow) al repositorio.

Dos defectos reales detectados por `ruff check` sobre app/:

1. F601 `app/db.py:227` — `MIGRATIONS` define la clave "tratos" dos veces; el
   diccionario se queda solo con la segunda, así que las columnas de pago y
   cotización nunca se migran en una base anterior a ellas.
2. F841 `app/main.py:1536` — `titulo_pub` se consulta y no se usa: la
   notificación de "cotización respondida" no dice de qué publicación se trata.

Ambas pruebas deben fallar antes del arreglo (RED) y pasar después (GREEN).
Aíslan la base en un directorio temporal: no tocan `data/app.db`.
"""
import pathlib
import sqlite3
import sys

import pytest
from fastapi.testclient import TestClient

RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

import app.db as db  # noqa: E402

PIN = "123456"

# Columnas que el código consulta en `tratos` (pago, confirmación, cotización,
# comprobante y bandera de stock). Todas deben existir tras `migrate()`.
COLUMNAS_TRATOS = {
    "pago_comprador",
    "pago_vendedor",
    "confirmado",
    "cotizacion_id",
    "comprobante",
    "stock_descontado",
}


def test_migraciones_declaran_todas_las_columnas_de_tratos():
    declaradas = set(db.MIGRATIONS["tratos"])
    faltan = COLUMNAS_TRATOS - declaradas
    assert not faltan, f"MIGRATIONS['tratos'] no declara: {sorted(faltan)}"


def test_migrate_agrega_columnas_a_una_base_antigua(tmp_path):
    """Simula una base creada solo con el esquema base (sin migraciones)."""
    ruta = tmp_path / "antigua.db"
    con = sqlite3.connect(ruta)
    con.row_factory = sqlite3.Row
    con.executescript(db.SCHEMA)
    con.commit()

    db.migrate(con)
    columnas = {r["name"] for r in con.execute("PRAGMA table_info(tratos)")}
    con.close()

    faltan = COLUMNAS_TRATOS - columnas
    assert not faltan, f"migrate() no agregó: {sorted(faltan)}"


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db.DB_PATH = tmp_path_factory.mktemp("datos-ecc") / "pruebas.db"
    db.init_db()
    from app.main import app as fastapi_app
    with TestClient(fastapi_app) as c:
        yield c


def entrar(client, telefono):
    r = client.post("/api/login_pin", json={"telefono": telefono, "pin": PIN})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_notificacion_de_respuesta_nombra_la_publicacion(client):
    vendedor = entrar(client, "999000005")
    comprador = entrar(client, "999000004")
    titulo = "Clase de refuerzo escolar ECC"

    r = client.post("/api/publicaciones", json={
        "tipo": "servicio", "categoria": "clases", "titulo": titulo,
        "descripcion": "Refuerzo de matemática y comunicación para primaria.",
        "precio": "20", "medios_pago": "yape", "zona": "Piura Centro",
        "client_id": "pytest-ecc-notif",
    }, headers=vendedor)
    assert r.status_code == 200, r.text
    pub_id = r.json()["id"]

    r = client.post("/api/cotizaciones", json={
        "publicacion_id": pub_id,
        "descripcion": "¿Atiendes los sábados por la mañana?",
    }, headers=comprador)
    assert r.status_code == 200, r.text
    cot_id = r.json()["id"]

    r = client.post(f"/api/cotizaciones/{cot_id}/responder", json={
        "respuesta": "puedo", "precio_respuesta": "18",
    }, headers=vendedor)
    assert r.status_code == 200, r.text

    avisos = client.get("/api/notificaciones", headers=comprador).json()["items"]
    assert avisos, "el comprador no recibió ninguna notificación"
    texto = f"{avisos[0].get('titulo', '')} {avisos[0].get('cuerpo', '')}"
    assert titulo in texto, f"la notificación no nombra la publicación: {texto!r}"
