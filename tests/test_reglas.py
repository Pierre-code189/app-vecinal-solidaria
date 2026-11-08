"""Pruebas de reglas de negocio, aisladas de producción.

Levantan la app contra una base temporal (no tocan data/app.db) y comprueban
las reglas que el flujo real debe respetar: privacidad, permisos, doble
confirmación, vistos buenos y stock.

Ejecutar:  .venv/bin/pytest -q
"""
import pathlib
import sys

import pytest
from fastapi.testclient import TestClient

RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

import app.db as db  # noqa: E402

PIN = "123456"


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    db.DB_PATH = tmp_path_factory.mktemp("datos") / "pruebas.db"
    db.init_db()
    from app.main import app as fastapi_app
    with TestClient(fastapi_app) as c:
        yield c


def entrar(client, telefono):
    r = client.post("/api/login_pin", json={"telefono": telefono, "pin": PIN})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def juan(client):
    return entrar(client, "999000002")


@pytest.fixture(scope="session")
def ana(client):
    return entrar(client, "999000003")


@pytest.fixture(scope="session")
def pedro(client):
    return entrar(client, "999000004")


def listado(client, **params):
    r = client.get("/api/publicaciones", params={"limit": 50, **params})
    assert r.status_code == 200
    return r.json()["items"]


def publicar(client, headers, **cambios):
    cuerpo = {
        "tipo": "producto",
        "categoria": "alimentos",
        "titulo": "Producto de prueba",
        "descripcion": "Publicación creada por las pruebas automáticas.",
        "precio": "5",
        "medios_pago": "yape",
        "zona": "Piura Centro",
        "stock": 1,
        "client_id": f"pytest-{cambios.get('titulo', 'x')}-{len(cambios)}",
    }
    cuerpo.update(cambios)
    r = client.post("/api/publicaciones", json=cuerpo, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------------------------------------------------------------- privacidad
def test_invitado_no_ve_contacto(client):
    pub = listado(client)[0]
    r = client.get(f"/api/publicaciones/{pub['id']}")
    assert r.status_code == 200
    datos = r.json()
    assert datos.get("telefono") in (None, "")
    assert not datos.get("yape")
    assert not datos.get("plin")


def test_detalle_con_sesion_expone_contacto(client, juan):
    pub = listado(client, zona="Piura Centro")[0]
    r = client.get(f"/api/publicaciones/{pub['id']}", headers=juan)
    assert r.status_code == 200


# ------------------------------------------------------------------- acceso
def test_pin_incorrecto(client):
    r = client.post("/api/login_pin", json={"telefono": "999000002", "pin": "000000"})
    assert r.status_code in (400, 401)


def test_moderacion_exige_rol(client, ana):
    r = client.get("/api/moderacion/reportes", headers=ana)
    assert r.status_code == 403


def test_sin_sesion_no_se_puede_publicar(client):
    r = client.post("/api/publicaciones", json={"tipo": "producto", "categoria": "alimentos",
                                                "titulo": "Sin sesión", "descripcion": "x" * 10,
                                                "zona": "Piura Centro"})
    assert r.status_code == 401


# --------------------------------------------------------------- validación
def test_titulo_corto_se_rechaza(client, juan):
    r = client.post("/api/publicaciones", json={
        "tipo": "producto", "categoria": "alimentos", "titulo": "ab",
        "descripcion": "Descripción suficientemente larga", "zona": "Piura Centro"})
    assert r.status_code == 422


# ------------------------------------------------------------ cotizaciones
def test_no_puedes_cotizar_lo_tuyo(client, juan):
    propias = [p for p in listado(client) if p["nombre"] == "Juan Quispe" and p["tipo"] != "favor_ofrecido"]
    assert propias
    r = client.post("/api/cotizaciones", json={"publicacion_id": propias[0]["id"],
                                               "descripcion": "Quiero mi propio servicio"},
                    headers=juan)
    assert r.status_code == 400


# ----------------------------------------------------------- reportes/vistos
def test_reporte_duplicado(client, ana, pedro):
    ajenas = [p for p in listado(client) if p["nombre"] == "Pedro Chunga"]
    assert ajenas
    pub = ajenas[0]["id"]
    primero = client.post("/api/reportes", json={"publicacion_id": pub, "motivo": "Parece una estafa"}, headers=ana)
    assert primero.status_code in (200, 400)
    segundo = client.post("/api/reportes", json={"publicacion_id": pub, "motivo": "Parece una estafa"}, headers=ana)
    assert segundo.status_code == 400


def test_visto_bueno_exige_trato_cerrado(client, ana, pedro):
    ajenas = [p for p in listado(client) if p["nombre"] == "Pedro Chunga"]
    r = client.post("/api/vistos", json={"publicacion_id": ajenas[0]["id"]}, headers=ana)
    assert r.status_code == 400


# ---------------------------------------------------------- doble confirmación
def test_trato_necesita_las_dos_confirmaciones(client, ana, pedro):
    pub = publicar(client, pedro, titulo="Trato doble prueba", stock=None)
    r = client.post("/api/tratos", json={"publicacion_id": pub}, headers=ana)
    assert r.status_code == 200
    tid = r.json()["id"]

    assert client.post(f"/api/tratos/{tid}/cerrar", headers=ana).status_code == 200
    estados = {t["id"]: t["estado"] for t in client.get("/api/tratos", headers=ana).json()}
    assert estados[tid] == "acordado"  # una sola marca no cierra

    assert client.post(f"/api/tratos/{tid}/cerrar", headers=pedro).status_code == 200
    estados = {t["id"]: t["estado"] for t in client.get("/api/tratos", headers=ana).json()}
    assert estados[tid] == "cerrado"

    # y ahora sí se puede dar el visto bueno
    r = client.post("/api/vistos", json={"publicacion_id": pub}, headers=ana)
    assert r.status_code == 200


# -------------------------------------------------------------------- stock
def test_stock_descuenta_al_cerrar_y_bloquea(client, juan, ana):
    pub = publicar(client, juan, titulo="Stock de prueba")
    assert client.get(f"/api/publicaciones/{pub}").json()["stock"] == 1

    r = client.post("/api/tratos", json={"publicacion_id": pub}, headers=ana)
    assert r.status_code == 200
    tid = r.json()["id"]

    client.post(f"/api/tratos/{tid}/cerrar", headers=ana)
    client.post(f"/api/tratos/{tid}/cerrar", headers=juan)

    assert client.get(f"/api/publicaciones/{pub}").json()["stock"] == 0

    agotado = client.post("/api/cotizaciones", json={"publicacion_id": pub,
                                                     "descripcion": "Otra consulta más"}, headers=ana)
    assert agotado.status_code == 400
    assert "agot" in agotado.json()["detail"].lower()
