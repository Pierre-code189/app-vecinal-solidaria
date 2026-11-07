import sqlite3, hashlib, uuid, time, os, threading
LOCK=threading.Lock()
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import re as _re
def clean_txt(s): return _re.sub(r'<[^>]*>','', s or '').strip()
TIPOS={'producto','servicio','favor_solicitado','favor_ofrecido'}
from typing import Optional

DB=Path("/root/app-vecinal-solidaria/data/app.db")
DB.parent.mkdir(parents=True, exist_ok=True)
def db():
    c=sqlite3.connect(DB, timeout=30, check_same_thread=False); c.row_factory=sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL"); c.execute("PRAGMA busy_timeout=30000")
    return c
def init():
    c=db(); cur=c.cursor()
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS usuarios(id TEXT PRIMARY KEY, nombre TEXT, zona TEXT, telefono TEXT UNIQUE, email TEXT UNIQUE, pass TEXT, rol TEXT DEFAULT 'vecino', yape TEXT, creado INTEGER);
    CREATE TABLE IF NOT EXISTS sesiones(token TEXT PRIMARY KEY, usuario_id TEXT, creado INTEGER);
    CREATE TABLE IF NOT EXISTS publicaciones(id TEXT PRIMARY KEY, autor_id TEXT, tipo TEXT, categoria TEXT, titulo TEXT, descripcion TEXT, precio TEXT, zona TEXT, lat REAL, lng REAL, estado TEXT DEFAULT 'activa', es_emergencia INTEGER DEFAULT 0, creado INTEGER, client_id TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS vistos(id TEXT PRIMARY KEY, publicacion_id TEXT, usuario_id TEXT, creado INTEGER, UNIQUE(publicacion_id, usuario_id));
    CREATE TABLE IF NOT EXISTS reportes(id TEXT PRIMARY KEY, publicacion_id TEXT, usuario_id TEXT, motivo TEXT, creado INTEGER);
    CREATE TABLE IF NOT EXISTS config_emergencia(id TEXT PRIMARY KEY, activa INTEGER DEFAULT 0, activada_por TEXT, activada_en INTEGER, motivo TEXT);
    INSERT OR IGNORE INTO config_emergencia VALUES('global',0,NULL,NULL,'');
    """)
    # seed users
    def mk(uid,nombre,zona,tel,email,pw,rol='vecino',yape=None):
        h=hashlib.sha256(pw.encode()).hexdigest()
        cur.execute("INSERT OR IGNORE INTO usuarios VALUES(?,?,?,?,?,?,?,?,?)",(uid,nombre,zona,tel,email,h,rol,yape,int(time.time())))
    mk('u-mod','María Moderadora','Zona Centro','999000001','mod@app.local','mod123','moderador','999000001')
    mk('u-gas','Juan Gasfitero','Zona Centro','999000002','juan@app.local','gas123','vecino','999000002')
    mk('u-carp','Ana Carpintera','Zona Norte','999000003','ana@app.local','carp123','vecino','999000003')
    mk('u-vec','Pedro Vecino','Zona Centro','999000004','pedro@app.local','pedro123','vecino',None)
    mk('u-vec2','Lucía Vecina','Zona Sur','999000005','lucia@app.local','lucia123','vecino','999000005')
    pubs=[('p1','u-gas','servicio','gasfitería','Gasfitero 24h - destapes y fugas','Destapes, instalación de caños, fugas. Atención inmediata en Zona Centro.','A convenir','Zona Centro',-12.0464,-77.0428,0),
          ('p2','u-carp','servicio','carpintería','Carpintería a medida','Puertas, mesas, closets. Presupuesto con foto y medidas.','Intercambio / sin dinero','Zona Norte',-12.03,-77.05,0),
          ('p3','u-vec','producto','alimentos','Pastelitos caseros de la vecina','Pastelitos dulces y salados por encargo. Receta casera.','S/ 2.00','Zona Centro',-12.046,-77.043,0),
          ('p4','u-vec','favor_solicitado','préstamo','Presto muleta por 1 semana','Vecino con pierna lesionada necesita muleta prestada. Se devuelve en buen estado.','Intercambio / sin dinero','Zona Centro',-12.047,-77.042,0),
          ('p5','u-vec2','favor_ofrecido','movilidad','Comparto auto al colegio (zona+franja)','Llevo a mi hijo al colegio en Zona Centro, franja 7-8am. Punto público: parque. Sin pago.','Intercambio / sin dinero','Zona Centro',-12.045,-77.041,0),
          ('p6','u-gas','servicio','electricidad','Electricista - instalaciones','Instalaciones y reparaciones eléctricas.','A convenir','Zona Sur',-12.06,-77.06,1),
          ('p7','u-carp','favor_solicitado','herramientas','Necesito taladro prestado','Para colgar cuadros este fin de semana. Devuelvo domingo.','Intercambio / sin dinero','Zona Norte',-12.031,-77.051,0),
          ('p8','u-vec2','producto','alimentos','Lasaña casera (vecina Lucía)','Lasaña de carne por encargo, muy recomendada en la zona.','S/ 25.00','Zona Sur',-12.061,-77.059,0)]
    for pid,aid,tipo,cat,tit,desc,precio,zona,lat,lng,em in pubs:
        cur.execute("INSERT OR IGNORE INTO publicaciones VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(pid,aid,tipo,cat,tit,desc,precio,zona,lat,lng,'activa',em,int(time.time()),pid))
    vistos=[('v1','p1','u-vec'),('v2','p1','u-vec2'),('v3','p3','u-gas'),('v4','p8','u-vec'),('v5','p2','u-vec')]
    for vid,pid,uid in vistos: cur.execute("INSERT OR IGNORE INTO vistos VALUES(?,?,?,?)",(vid,pid,uid,int(time.time())))
    c.commit(); c.close()
init()
app=FastAPI(title="App Vecinal Solidaria")
@app.middleware("http")
async def log_req(request:Request, call_next):
    print(f"{request.method} {request.url.path}", flush=True)
    resp=await call_next(request)
    resp.headers["Content-Security-Policy"]="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; connect-src 'self'"
    resp.headers["X-Content-Type-Options"]="nosniff"; resp.headers["X-Frame-Options"]="DENY"
    return resp

class Reg(BaseModel):
    nombre:str=Field(min_length=2); zona:str=Field(min_length=2); telefono:str=Field(pattern=r'^[0-9]{9}$'); email:str=Field(min_length=5); password:str=Field(min_length=6); yape:Optional[str]=None
class Login(BaseModel):
    email:str=Field(min_length=5); password:str=Field(min_length=1)
class Pub(BaseModel):
    tipo:str; categoria:str=Field(min_length=2); titulo:str=Field(min_length=3); descripcion:str=Field(min_length=5); precio:Optional[str]="Intercambio / sin dinero"; zona:str=Field(min_length=2); lat:Optional[float]=None; lng:Optional[float]=None; es_emergencia:bool=False; client_id:Optional[str]=None
class Visto(BaseModel): publicacion_id:str
class Report(BaseModel): publicacion_id:str; motivo:str
class Emerg(BaseModel): activa:bool=False; motivo:Optional[str]=""

def token_user(token:Optional[str]):
    if not token: return None
    c=db(); r=c.execute("SELECT usuario_id FROM sesiones WHERE token=?",(token,)).fetchone(); c.close()
    return r[0] if r else None
def auth(request:Request):
    authz=request.headers.get("authorization",""); uid=token_user(authz[7:] if authz.startswith("Bearer ") else "")
    if not uid: raise HTTPException(401,"Requiere login")
    return uid
def clean(u):
    return {"id":u["id"],"nombre":u["nombre"],"zona":u["zona"],"telefono":u["telefono"],"email":u["email"],"rol":u["rol"],"yape":u["yape"]}

@app.post("/api/registro")
def registro(r:Reg):
    c=db()
    if c.execute("SELECT id FROM usuarios WHERE email=? OR telefono=?",(r.email,r.telefono)).fetchone(): raise HTTPException(400,"Email o teléfono ya registrado")
    uid=str(uuid.uuid4()); h=hashlib.sha256(r.password.encode()).hexdigest()
    c.execute("INSERT INTO usuarios VALUES(?,?,?,?,?,?,?,?,?)",(uid,r.nombre,r.zona,r.telefono,r.email,h,'vecino',r.yape,int(time.time()))); c.commit(); c.close()
    return {"ok":True,"id":uid}
@app.post("/api/login")
def login(r:Login):
    c=db(); u=c.execute("SELECT * FROM usuarios WHERE email=?",(r.email,)).fetchone(); c.close()
    if not u or u["pass"]!=hashlib.sha256(r.password.encode()).hexdigest(): raise HTTPException(401,"Credenciales incorrectas")
    tok=uuid.uuid4().hex; c=db(); c.execute("INSERT INTO sesiones VALUES(?,?,?)",(tok,u["id"],int(time.time()))); c.commit(); c.close()
    return {"token":tok,"usuario":clean(u)}
@app.get("/api/perfil")
def perfil(request:Request):
    uid=auth(request); c=db(); u=c.execute("SELECT * FROM usuarios WHERE id=?",(uid,)).fetchone(); c.close(); return clean(u)
@app.get("/api/publicaciones")
def lista(request:Request, tipo:Optional[str]=None, categoria:Optional[str]=None, q:Optional[str]=None, emergencia:bool=False, limit:int=20, offset:int=0):
    limit=max(1,min(limit,50)); offset=max(0,offset)
    c=db(); query="SELECT p.*, u.nombre autor, u.telefono, u.yape, (SELECT COUNT(*) FROM vistos v WHERE v.publicacion_id=p.id) vistos FROM publicaciones p JOIN usuarios u ON p.autor_id=u.id WHERE p.estado='activa'"
    args=[]
    if emergencia: query+=" AND p.es_emergencia=1"
    elif tipo: query+=" AND p.tipo=?"; args.append(tipo)
    if categoria: query+=" AND p.categoria=?"; args.append(categoria)
    if q: query+=" AND (p.titulo LIKE ? OR p.descripcion LIKE ?)"; args+=[f"%{q}%",f"%{q}%"]
    query+=" ORDER BY p.creado DESC LIMIT ? OFFSET ?"; args+=[limit,offset]
    rows=[dict(r) for r in c.execute(query,args).fetchall()]; c.close()
    if not token_user(request.headers.get("authorization","")[7:] if request.headers.get("authorization","").startswith("Bearer ") else ""):
        for r in rows: r.pop("telefono",None); r.pop("yape",None); r.pop("lat",None); r.pop("lng",None)
    return rows
@app.get("/api/publicaciones/{pid}")
def detalle(pid:str):
    c=db(); r=c.execute("SELECT p.*, u.nombre autor, u.telefono, u.yape, (SELECT COUNT(*) FROM vistos WHERE publicacion_id=p.id) vistos FROM publicaciones p JOIN usuarios u ON p.autor_id=u.id WHERE p.id=?",(pid,)).fetchone(); c.close()
    if not r: raise HTTPException(404,"No encontrada")
    return dict(r)
@app.post("/api/publicaciones")
def crear(p:Pub, request:Request):
    uid=auth(request)
    if p.tipo not in TIPOS: raise HTTPException(400,'Tipo inválido')
    p.titulo=clean_txt(p.titulo); p.descripcion=clean_txt(p.descripcion); p.categoria=clean_txt(p.categoria)
    c=db(); cid=p.client_id or str(uuid.uuid4())
    ex=c.execute("SELECT id FROM publicaciones WHERE client_id=? AND autor_id=?",(cid,uid)).fetchone()
    if ex: c.close(); return {"ok":True,"id":ex[0],"duplicado":True}
    pid=str(uuid.uuid4())
    c.execute("INSERT INTO publicaciones VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(pid,uid,p.tipo,p.categoria,p.titulo,p.descripcion,p.precio,p.zona,p.lat,p.lng,'activa',1 if p.es_emergencia else 0,int(time.time()),cid)); c.commit(); c.close()
    return {"ok":True,"id":pid}
@app.post("/api/visto-bueno")
def visto(v:Visto, request:Request):
    uid=auth(request); c=db(); p=c.execute("SELECT * FROM publicaciones WHERE id=?",(v.publicacion_id,)).fetchone()
    if not p: raise HTTPException(404,"No encontrada")
    if p["autor_id"]==uid: raise HTTPException(400,"No puedes recomendar tu propia publicación")
    if p["estado"]!='activa': raise HTTPException(400,"Solo publicaciones activas")
    try: c.execute("INSERT INTO vistos VALUES(?,?,?,?)",(str(uuid.uuid4()),v.publicacion_id,uid,int(time.time()))); c.commit()
    except Exception: raise HTTPException(400,"Ya recomendaste esta publicación")
    c.close(); return {"ok":True}
@app.post("/api/reportar")
def reportar(r:Report, request:Request):
    uid=auth(request); c=db()
    pub=c.execute("SELECT autor_id FROM publicaciones WHERE id=?",(r.publicacion_id,)).fetchone()
    if not pub: raise HTTPException(404,"Publicación no encontrada")
    if pub[0]==uid: raise HTTPException(400,"No puedes reportar tu propia publicación")
    if not clean_txt(r.motivo): raise HTTPException(400,"Motivo requerido")
    if c.execute("SELECT id FROM reportes WHERE publicacion_id=? AND usuario_id=?",(r.publicacion_id,uid)).fetchone(): raise HTTPException(400,"Ya reportaste esta publicación")
    c.execute("INSERT INTO reportes VALUES(?,?,?,?,?)",(str(uuid.uuid4()),r.publicacion_id,uid,clean_txt(r.motivo),int(time.time()))); c.commit(); c.close(); return {"ok":True}
@app.get("/api/emergencia")
def emerg():
    c=db(); r=c.execute("SELECT * FROM config_emergencia WHERE id='global'").fetchone(); pubs=[dict(x) for x in c.execute("SELECT p.*, u.nombre autor FROM publicaciones p JOIN usuarios u ON p.autor_id=u.id WHERE p.es_emergencia=1 AND p.estado='activa'").fetchall()]; c.close()
    return {"activa":bool(r["activa"]),"activada_por":r["activada_por"],"motivo":r["motivo"],"reportes":pubs}
@app.post("/api/emergencia/activar")
def emerg_act(e:Emerg, request:Request):
    uid=auth(request); c=db(); u=c.execute("SELECT rol FROM usuarios WHERE id=?",(uid,)).fetchone()
    if u["rol"]!="moderador": raise HTTPException(403,"Solo el moderador activa la emergencia")
    c.execute("UPDATE config_emergencia SET activa=?, activada_por=?, activada_en=?, motivo=? WHERE id='global'",(1 if e.activa else 0,uid,int(time.time()),clean_txt(e.motivo or ""))); c.commit(); c.close(); return {"ok":True}
@app.get("/api/salud")
def salud(): return {"ok":True,"app":"App Vecinal Solidaria","docs":"/docs"}
static=Path(__file__).parent/"static"
app.mount("/", StaticFiles(directory=str(static), html=True), name="static")
