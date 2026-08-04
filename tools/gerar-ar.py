#!/usr/bin/env python3
"""MARATU — gera os modelos de AR dos posteres.

Pra cada poster e cada tamanho (A4/A3/A2/A1) sai um par de arquivos:
  <id>-<tam>.glb   Android (Scene Viewer) e o visualizador 3D do site
  <id>-<tam>.usdz  iOS (AR Quick Look)

A geometria e sempre a mesma: um quadro fino em pe, com a arte na frente e
as bordas cinza, medindo o tamanho real do papel em metros. Quem manda na
escala do AR e o arquivo, entao cada tamanho tem o seu.

Uso:  python3 tools/gerar-ar.py [--saida DIR] [--so pordosol,atalaia]
"""

import argparse
import json
import os
import struct
import sys
import time
import urllib.request
from io import BytesIO

from PIL import Image

API = "https://maratu-api.raphaelnascimento.workers.dev"
# a borda recusa o User-Agent padrao do urllib (403)
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MARATU/gerar-ar"}


def buscar(url, timeout=60):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout)

# --- medidas reais do papel, em metros -------------------------------------
TAMANHOS = {
    "A4": (0.210, 0.297),
    "A3": (0.297, 0.420),
    "A2": (0.420, 0.594),
    "A1": (0.594, 0.841),
}

ESPESSURA = 0.005          # 5 mm, um quadro fino
LARGURA_TEXTURA = 1024     # px; o resto e peso a toa no celular
QUALIDADE_JPEG = 82
CINZA = [0.82, 0.82, 0.82, 1.0]


# --- catalogo --------------------------------------------------------------
def listar_posteres():
    """A fonte de verdade e o D1, nao os arquivos do repo: os ids do card vem
    de la e e por eles que o site monta o nome do modelo."""
    with buscar(API + "/api/catalog", 30) as r:
        cat = json.load(r)
    saida = []
    for p in cat.get("produtos", []):
        if p.get("subcategoria") != "posteres" or not p.get("ativo"):
            continue
        img = p.get("imagem_principal")
        if not img:
            print("sem imagem, pulando: %s" % p.get("id"), file=sys.stderr)
            continue
        saida.append({"id": p["id"], "nome": p.get("nome") or p["id"],
                      "url": API + "/img/" + img.lstrip("/")})
    return saida


# --- textura ---------------------------------------------------------------
def carregar_textura(url):
    """webp/png -> jpeg reduzido. glTF e USDZ nao comem webp."""
    with buscar(url) as r:
        bruto = r.read()
    img = Image.open(BytesIO(bruto)).convert("RGB")
    if img.width > LARGURA_TEXTURA:
        alt = round(img.height * LARGURA_TEXTURA / img.width)
        img = img.resize((LARGURA_TEXTURA, alt), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=QUALIDADE_JPEG, optimize=True, progressive=True)
    return buf.getvalue()


# --- geometria -------------------------------------------------------------
def frente(w, h, z):
    """Quad da arte: 4 vertices, normal +Z, uv cobrindo a imagem inteira."""
    x, y = w / 2, h / 2
    pos = [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    nor = [(0, 0, 1)] * 4
    # V invertido: glTF conta a textura de cima pra baixo
    uv = [(0, 1), (1, 1), (1, 0), (0, 0)]
    idx = [0, 1, 2, 0, 2, 3]
    return pos, nor, uv, idx


def caixa(w, h, d):
    """Corpo do quadro. Sem uv util, so serve pra dar espessura e verso."""
    x, y, z = w / 2, h / 2, d / 2
    faces = [
        # (4 cantos, normal)
        ([(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)], (0, 0, 1)),    # frente
        ([(x, -y, -z), (-x, -y, -z), (-x, y, -z), (x, y, -z)], (0, 0, -1)),  # verso
        ([(x, -y, z), (x, -y, -z), (x, y, -z), (x, y, z)], (1, 0, 0)),    # direita
        ([(-x, -y, -z), (-x, -y, z), (-x, y, z), (-x, y, -z)], (-1, 0, 0)),  # esquerda
        ([(-x, y, z), (x, y, z), (x, y, -z), (-x, y, -z)], (0, 1, 0)),    # topo
        ([(-x, -y, -z), (x, -y, -z), (x, -y, z), (-x, -y, z)], (0, -1, 0)),  # base
    ]
    pos, nor, uv, idx = [], [], [], []
    for cantos, n in faces:
        base = len(pos)
        pos.extend(cantos)
        nor.extend([n] * 4)
        uv.extend([(0, 0), (1, 0), (1, 1), (0, 1)])
        idx.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    return pos, nor, uv, idx


# --- GLB -------------------------------------------------------------------
def _pad4(b, enchimento=b"\x00"):
    return b + enchimento * ((4 - len(b) % 4) % 4)


def montar_glb(w, h, jpeg):
    """glTF 2.0 binario, uma malha com duas primitivas (arte + moldura)."""
    fz = ESPESSURA / 2 + 0.0005          # a arte fica rente, sem brigar com a caixa
    f_pos, f_nor, f_uv, f_idx = frente(w, h, fz)
    c_pos, c_nor, c_uv, c_idx = caixa(w, h, ESPESSURA)

    pos = f_pos + c_pos
    nor = f_nor + c_nor
    uv = f_uv + c_uv
    idx_frente = f_idx
    idx_caixa = [i + len(f_pos) for i in c_idx]

    blobs, views, accs = [], [], []

    def add_view(data, target=None):
        blobs.append(_pad4(data))
        off = sum(len(b) for b in blobs[:-1])
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        views.append(v)
        return len(views) - 1

    def add_acc(data, view, count, tipo, comp, minmax=None):
        a = {"bufferView": view, "componentType": comp, "count": count, "type": tipo}
        if minmax:
            a["min"], a["max"] = minmax
        accs.append(a)
        return len(accs) - 1

    b_pos = b"".join(struct.pack("<3f", *p) for p in pos)
    mins = [min(p[i] for p in pos) for i in range(3)]
    maxs = [max(p[i] for p in pos) for i in range(3)]
    a_pos = add_acc(b_pos, add_view(b_pos, 34962), len(pos), "VEC3", 5126, (mins, maxs))

    b_nor = b"".join(struct.pack("<3f", *n) for n in nor)
    a_nor = add_acc(b_nor, add_view(b_nor, 34962), len(nor), "VEC3", 5126)

    b_uv = b"".join(struct.pack("<2f", *t) for t in uv)
    a_uv = add_acc(b_uv, add_view(b_uv, 34962), len(uv), "VEC2", 5126)

    b_if = b"".join(struct.pack("<H", i) for i in idx_frente)
    a_if = add_acc(b_if, add_view(b_if, 34963), len(idx_frente), "SCALAR", 5123)

    b_ic = b"".join(struct.pack("<H", i) for i in idx_caixa)
    a_ic = add_acc(b_ic, add_view(b_ic, 34963), len(idx_caixa), "SCALAR", 5123)

    v_img = add_view(jpeg)

    gltf = {
        "asset": {"version": "2.0", "generator": "MARATU gerar-ar.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Poster"}],
        "meshes": [{
            "name": "Poster",
            "primitives": [
                {"attributes": {"POSITION": a_pos, "NORMAL": a_nor, "TEXCOORD_0": a_uv},
                 "indices": a_if, "material": 0},
                {"attributes": {"POSITION": a_pos, "NORMAL": a_nor, "TEXCOORD_0": a_uv},
                 "indices": a_ic, "material": 1},
            ],
        }],
        "materials": [
            {"name": "Arte",
             "pbrMetallicRoughness": {
                 "baseColorTexture": {"index": 0},
                 "metallicFactor": 0.0, "roughnessFactor": 0.65}},
            {"name": "Moldura",
             "pbrMetallicRoughness": {
                 "baseColorFactor": CINZA,
                 "metallicFactor": 0.0, "roughnessFactor": 0.9}},
        ],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": v_img, "mimeType": "image/jpeg"}],
        "bufferViews": views,
        "accessors": accs,
        "buffers": [{"byteLength": sum(len(b) for b in blobs)}],
    }

    # o chunk JSON completa com espaco, o binario com zero (exigencia do glTF 2.0)
    json_chunk = _pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b"\x20")
    bin_chunk = _pad4(b"".join(blobs))

    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    out = BytesIO()
    out.write(struct.pack("<4sII", b"glTF", 2, total))
    out.write(struct.pack("<I4s", len(json_chunk), b"JSON"))
    out.write(json_chunk)
    out.write(struct.pack("<I4s", len(bin_chunk), b"BIN\x00"))
    out.write(bin_chunk)
    return out.getvalue()


# --- USDZ ------------------------------------------------------------------
def _pts(lista):
    return ", ".join("(%.5f, %.5f, %.5f)" % p for p in lista)


def montar_usda(w, h, nome_textura):
    fz = ESPESSURA / 2 + 0.0005
    f_pos, _, _, _ = frente(w, h, fz)
    c_pos, _, _, c_idx = caixa(w, h, ESPESSURA)

    # a caixa vira faces de 4 cantos (USD aceita quad direto)
    quads = [c_pos[i:i + 4] for i in range(0, len(c_pos), 4)]
    c_flat = [p for q in quads for p in q]
    c_counts = ", ".join(["4"] * len(quads))   # USD quer virgula, espaco nao parseia
    c_indices = ", ".join(str(i) for i in range(len(c_flat)))

    # ao contrario do glTF: no USD o st (0,0) e o canto de BAIXO da imagem
    uv = "(0, 0), (1, 0), (1, 1), (0, 1)"

    return f'''#usda 1.0
(
    defaultPrim = "Root"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Root" (
    prepend apiSchemas = ["Preliminary_AnchoringAPI"]
)
{{
    uniform token preliminary:anchoring:type = "plane"
    uniform token preliminary:planeAnchoring:alignment = "vertical"

    def Mesh "Arte"
    {{
        uniform bool doubleSided = 0
        int[] faceVertexCounts = [4]
        int[] faceVertexIndices = [0, 1, 2, 3]
        point3f[] points = [{_pts(f_pos)}]
        texCoord2f[] primvars:st = [{uv}] (
            interpolation = "faceVarying"
        )
        rel material:binding = </Root/Looks/Arte>
        uniform token subdivisionScheme = "none"
    }}

    def Mesh "Moldura"
    {{
        uniform bool doubleSided = 0
        int[] faceVertexCounts = [{c_counts}]
        int[] faceVertexIndices = [{c_indices}]
        point3f[] points = [{_pts(c_flat)}]
        rel material:binding = </Root/Looks/Moldura>
        uniform token subdivisionScheme = "none"
    }}

    def Scope "Looks"
    {{
        def Material "Arte"
        {{
            token outputs:surface.connect = </Root/Looks/Arte/Surface.outputs:surface>

            def Shader "Surface"
            {{
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </Root/Looks/Arte/Textura.outputs:rgb>
                float inputs:metallic = 0
                float inputs:roughness = 0.65
                token outputs:surface
            }}

            def Shader "Textura"
            {{
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @{nome_textura}@
                float2 inputs:st.connect = </Root/Looks/Arte/Leitor.outputs:result>
                token inputs:wrapS = "clamp"
                token inputs:wrapT = "clamp"
                float3 outputs:rgb
            }}

            def Shader "Leitor"
            {{
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }}
        }}

        def Material "Moldura"
        {{
            token outputs:surface.connect = </Root/Looks/Moldura/Surface.outputs:surface>

            def Shader "Surface"
            {{
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = ({CINZA[0]}, {CINZA[1]}, {CINZA[2]})
                float inputs:metallic = 0
                float inputs:roughness = 0.9
                token outputs:surface
            }}
        }}
    }}
}}
'''


def montar_usdz(usda, jpeg, nome_textura):
    """Zip sem compressao, com cada arquivo comecando em multiplo de 64.

    O usdz e um zip cru: nada comprimido e tudo alinhado, porque o leitor da
    Apple mapeia os bytes direto da memoria. O zipfile do Python nao deixa
    controlar o alinhamento, entao o zip sai escrito na mao aqui.
    """
    arquivos = [("modelo.usda", usda.encode("utf-8")), (nome_textura, jpeg)]
    saida = BytesIO()
    registros = []
    dt = time.localtime()
    hora = (dt.tm_hour << 11) | (dt.tm_min << 5) | (dt.tm_sec // 2)
    data = ((dt.tm_year - 1980) << 9) | (dt.tm_mon << 5) | dt.tm_mday

    import zlib
    for nome, dados in arquivos:
        nome_b = nome.encode("utf-8")
        crc = zlib.crc32(dados) & 0xFFFFFFFF
        off_local = saida.tell()
        # o campo extra empurra os dados ate o proximo multiplo de 64
        cabecalho = 30 + len(nome_b)
        pad = (64 - (off_local + cabecalho) % 64) % 64
        if pad and pad < 4:          # extra field tem 4 bytes de cabecalho
            pad += 64
        extra = b""
        if pad:
            extra = struct.pack("<HH", 0x0001, pad - 4) + b"\x00" * (pad - 4)
        saida.write(struct.pack("<IHHHHHIIIHH", 0x04034B50, 20, 0, 0, hora, data,
                                crc, len(dados), len(dados), len(nome_b), len(extra)))
        saida.write(nome_b)
        saida.write(extra)
        assert saida.tell() % 64 == 0, "desalinhado: %s" % nome
        saida.write(dados)
        registros.append((nome_b, crc, len(dados), off_local))

    inicio_central = saida.tell()
    for nome_b, crc, tam, off in registros:
        saida.write(struct.pack("<IHHHHHHIIIHHHHHII", 0x02014B50, 20, 20, 0, 0,
                                hora, data, crc, tam, tam, len(nome_b), 0, 0, 0, 0, 0, off))
        saida.write(nome_b)
    fim_central = saida.tell()
    saida.write(struct.pack("<IHHHHIIH", 0x06054B50, 0, 0, len(registros), len(registros),
                            fim_central - inicio_central, inicio_central, 0))
    return saida.getvalue()


# --- main ------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", default="ar")
    ap.add_argument("--so", default="", help="lista de ids separados por virgula")
    ap.add_argument("--tamanhos", default="A4,A3,A2,A1")
    args = ap.parse_args()

    filtro = [s.strip() for s in args.so.split(",") if s.strip()]
    tams = [t.strip() for t in args.tamanhos.split(",") if t.strip()]
    os.makedirs(args.saida, exist_ok=True)

    total = 0
    manifesto = {}
    for p in listar_posteres():
        pid = p["id"]
        if filtro and pid not in filtro:
            continue
        try:
            jpeg = carregar_textura(p["url"])
        except Exception as e:
            print("imagem falhou (%s): %s" % (pid, e), file=sys.stderr)
            continue
        nome_textura = "arte.jpg"
        for tam in tams:
            w, h = TAMANHOS[tam]
            glb = montar_glb(w, h, jpeg)
            usdz = montar_usdz(montar_usda(w, h, nome_textura), jpeg, nome_textura)
            for ext, dados in (("glb", glb), ("usdz", usdz)):
                caminho = os.path.join(args.saida, "%s-%s.%s" % (pid, tam, ext))
                with open(caminho, "wb") as fh:
                    fh.write(dados)
                total += 1
            print("%-18s %s  glb %6.0f KB   usdz %6.0f KB"
                  % (pid, tam, len(glb) / 1024, len(usdz) / 1024))
        manifesto[pid] = tams

    # o site le isto pra saber quem tem modelo; poster novo entra sozinho
    with open(os.path.join(args.saida, "manifesto.json"), "w") as fh:
        json.dump({"posteres": manifesto, "gerado_em": time.strftime("%Y-%m-%d")}, fh)
    print("\n%d arquivos + manifesto em %s/" % (total, args.saida))


if __name__ == "__main__":
    main()
