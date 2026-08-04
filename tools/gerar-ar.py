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
import shutil
import struct
import subprocess
import sys
import tempfile
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

ESPESSURA = 0.005              # 5 mm de placa atras da arte
MOLDURA_LARGURA = 0.022        # 2,2 cm de borda em volta do papel
MOLDURA_PROFUNDIDADE = 0.022   # o quanto a moldura sai da parede
LARGURA_TEXTURA = 1024         # px; o resto e peso a toa no celular
QUALIDADE_JPEG = 82

# Os tres acabamentos que a loja oferece. "madeira" ganha textura desenhada
# na hora; as outras duas sao cor lisa.
MOLDURAS = {
    # preto de verdade: com cor alta e superficie muito aspera a luz do ambiente
    # espalha e a moldura le como cinza. Cor quase zero e acabamento mais liso
    # concentram o brilho numa faixa so e o resto fica preto.
    "preta":   {"cor": [0.012, 0.012, 0.012], "aspereza": 0.40, "nome": "preta"},
    "branca":  {"cor": [0.930, 0.918, 0.890], "aspereza": 0.60, "nome": "branca"},
    "madeira": {"cor": [0.400, 0.270, 0.155], "aspereza": 0.72, "nome": "madeira",
                "textura": True},
}
MOLDURA_PADRAO = "preta"


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


def textura_madeira(largura=384, altura=96):
    """Desenha um veio de madeira simples: faixas escuras irregulares sobre um
    marrom base. Cor lisa deixa a moldura com cara de plastico."""
    import math
    import random

    base = MOLDURAS["madeira"]["cor"]
    img = Image.new("RGB", (largura, altura))
    px = img.load()
    random.seed(7)                      # sempre a mesma madeira
    veios = [(random.uniform(0, largura), random.uniform(2.5, 7.0),
              random.uniform(0.06, 0.16)) for _ in range(14)]
    for x in range(largura):
        onda = math.sin(x / 19.0) * 2.0 + math.sin(x / 7.3) * 0.8
        escuro = 0.0
        for centro, espessura, forca in veios:
            d = abs(x - centro + onda)
            if d < espessura:
                escuro += forca * (1 - d / espessura)
        for y in range(altura):
            ruido = (random.random() - 0.5) * 0.035
            f = max(0.0, 1.0 - escuro + ruido)
            px[x, y] = tuple(min(255, max(0, int(c * 255 * f))) for c in base)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=88, optimize=True)
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


def caixa(w, h, d, centro=(0, 0, 0)):
    """Bloco retangular. Serve de placa de fundo e de barra da moldura."""
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
    cx, cy, cz = centro
    pos, nor, uv, idx = [], [], [], []
    for cantos, n in faces:
        base = len(pos)
        pos.extend([(p[0] + cx, p[1] + cy, p[2] + cz) for p in cantos])
        nor.extend([n] * 4)
        uv.extend([(0, 0), (1, 0), (1, 1), (0, 1)])
        idx.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    return pos, nor, uv, idx


def juntar(*grupos):
    """Cola varias caixas num unico conjunto, remendando os indices."""
    pos, nor, uv, idx = [], [], [], []
    for g in grupos:
        deslocamento = len(pos)
        pos.extend(g[0])
        nor.extend(g[1])
        uv.extend(g[2])
        idx.extend([i + deslocamento for i in g[3]])
    return pos, nor, uv, idx


def corpo_do_quadro(w, h):
    """Placa de fundo + as quatro barras da moldura em volta da arte.

    O verso encosta na parede em z=0. A arte fica na frente da placa e a
    moldura sobe mais alto que ela, como num quadro de verdade.
    """
    L = MOLDURA_LARGURA
    P = MOLDURA_PROFUNDIDADE
    placa_d = 0.005
    ext_w, ext_h = w + 2 * L, h + 2 * L

    placa = caixa(ext_w, ext_h, placa_d, (0, 0, placa_d / 2))
    meio_z = P / 2
    barras = [
        caixa(ext_w, L, P, (0, (h + L) / 2, meio_z)),    # topo
        caixa(ext_w, L, P, (0, -(h + L) / 2, meio_z)),   # base
        caixa(L, h, P, ((w + L) / 2, 0, meio_z)),        # direita
        caixa(L, h, P, (-(w + L) / 2, 0, meio_z)),       # esquerda
    ]
    return juntar(placa, *barras)


# --- GLB -------------------------------------------------------------------
def _pad4(b, enchimento=b"\x00"):
    return b + enchimento * ((4 - len(b) % 4) % 4)


def montar_glb(w, h, jpeg, moldura, madeira=None):
    """glTF 2.0 binario, uma malha com duas primitivas (arte + moldura)."""
    fz = ESPESSURA + 0.0005              # a arte fica rente a placa, sem brigar
    f_pos, f_nor, f_uv, f_idx = frente(w, h, fz)
    c_pos, c_nor, c_uv, c_idx = corpo_do_quadro(w, h)

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
    acabamento = MOLDURAS[moldura]
    imagens = [{"bufferView": v_img, "mimeType": "image/jpeg"}]
    texturas = [{"source": 0, "sampler": 0}]

    mat_moldura = {"metallicFactor": 0.0, "roughnessFactor": acabamento["aspereza"]}
    if madeira:
        v_mad = add_view(madeira)
        imagens.append({"bufferView": v_mad, "mimeType": "image/jpeg"})
        texturas.append({"source": 1, "sampler": 0})
        mat_moldura["baseColorTexture"] = {"index": 1}
    else:
        mat_moldura["baseColorFactor"] = acabamento["cor"] + [1.0]

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
            {"name": "Moldura", "pbrMetallicRoughness": mat_moldura},
        ],
        "textures": texturas,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "images": imagens,
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
def deitar(pontos, meia_volta=False):
    """Vira o modelo do plano XY (em pe) pro plano XZ (deitado), girando -90 em X.

    O ARKit ancora conteudo no plano XZ do anchor, com o Y sendo a normal da
    superficie. Numa parede, esse Y aponta pra fora dela. Modelo em pe (XY)
    entra na parede perpendicular, saindo feito prateleira — foi o que aconteceu
    no primeiro teste no iPhone. Deitado, a arte encosta na parede como quadro.
    (x, y, z) -> (x, z, -y): o topo vai pra -Z e a frente passa a olhar pra +Y.
    Nota: o glTF NAO leva esse tratamento. O Scene Viewer do Android quer o
    contrario — modelo em pe, verso em -Z — que e como o .glb ja sai.

    meia_volta gira 180 graus em torno do Y, mandando o topo pra +Z. Serve pra
    gerar um arquivo de prova quando so o aparelho pode dizer qual lado e o alto.
    """
    deitados = [(p[0], p[2], -p[1]) for p in pontos]
    if meia_volta:
        deitados = [(-p[0], p[1], -p[2]) for p in deitados]
    return deitados


def _pts(lista):
    return ", ".join("(%.5f, %.5f, %.5f)" % p for p in lista)


def montar_usda(w, h, nome_textura, moldura, nome_madeira=None, meia_volta=False):
    fz = ESPESSURA + 0.0005
    f_pos, _, _, _ = frente(w, h, fz)
    c_pos, _, _, _ = corpo_do_quadro(w, h)

    # o corpo vira faces de 4 cantos (USD aceita quad direto)
    quads = [c_pos[i:i + 4] for i in range(0, len(c_pos), 4)]
    c_flat = [p for q in quads for p in q]

    # so o USD vai deitado: e o que o ARKit espera pra grudar na parede
    f_pos = deitar(f_pos, meia_volta)
    c_flat = deitar(c_flat, meia_volta)
    c_counts = ", ".join(["4"] * len(quads))   # USD quer virgula, espaco nao parseia
    c_indices = ", ".join(str(i) for i in range(len(c_flat)))
    # cada face do corpo recebe a textura inteira; nas barras finas da moldura
    # isso vira o veio da madeira correndo pelo comprimento
    c_uv = ", ".join(["(0, 0), (1, 0), (1, 1), (0, 1)"] * len(quads))

    # ao contrario do glTF: no USD o st (0,0) e o canto de BAIXO da imagem
    uv = "(0, 0), (1, 0), (1, 1), (0, 1)"

    acabamento = MOLDURAS[moldura]
    cor = acabamento["cor"]
    if nome_madeira:
        superficie_moldura = f'''color3f inputs:diffuseColor.connect = </Root/Looks/Moldura/Textura.outputs:rgb>'''
        shaders_moldura = f'''
            def Shader "Textura"
            {{
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @{nome_madeira}@
                float2 inputs:st.connect = </Root/Looks/Moldura/Leitor.outputs:result>
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float3 outputs:rgb
            }}

            def Shader "Leitor"
            {{
                uniform token info:id = "UsdPrimvarReader_float2"
                string inputs:varname = "st"
                float2 outputs:result
            }}
'''
    else:
        superficie_moldura = f'''color3f inputs:diffuseColor = ({cor[0]}, {cor[1]}, {cor[2]})'''
        shaders_moldura = ""

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

    def Mesh "Arte" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
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

    def Mesh "Moldura" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
    {{
        uniform bool doubleSided = 0
        int[] faceVertexCounts = [{c_counts}]
        int[] faceVertexIndices = [{c_indices}]
        point3f[] points = [{_pts(c_flat)}]
        texCoord2f[] primvars:st = [{c_uv}] (
            interpolation = "faceVarying"
        )
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
                // string, nao token: com token o RealityKit nao acha o primvar
                // e a arte some (o quadro sai cinza no iPhone)
                string inputs:varname = "st"
                float2 outputs:result
            }}
        }}

        def Material "Moldura"
        {{
            token outputs:surface.connect = </Root/Looks/Moldura/Surface.outputs:surface>

            def Shader "Surface"
            {{
                uniform token info:id = "UsdPreviewSurface"
                {superficie_moldura}
                float inputs:metallic = 0
                float inputs:roughness = {acabamento["aspereza"]}
                token outputs:surface
            }}
{shaders_moldura}
        }}
    }}
}}
'''


def montar_usdz_apple(usda, jpeg, nome_textura, destino, extras=None):
    """Empacota com as ferramentas do proprio macOS, quando existem.

    O usdcat converte o texto pra crate binario (o que a Apple recomenda pro
    Quick Look) e o usdzip cuida do alinhamento do pacote. Mais seguro que
    escrever o zip na mao. Devolve False se as ferramentas nao existirem.
    """
    if not (os.path.exists("/usr/bin/usdcat") and os.path.exists("/usr/bin/usdzip")):
        return False
    tmp = tempfile.mkdtemp(prefix="maratu-usdz-")
    try:
        usda_path = os.path.join(tmp, "modelo.usda")
        usdc_path = os.path.join(tmp, "modelo.usdc")
        tex_path = os.path.join(tmp, nome_textura)
        with open(usda_path, "w") as fh:
            fh.write(usda)
        with open(tex_path, "wb") as fh:
            fh.write(jpeg)
        nomes = ["modelo.usdc", nome_textura]
        for nome, dados in (extras or {}).items():
            with open(os.path.join(tmp, nome), "wb") as fh:
                fh.write(dados)
            nomes.append(nome)
        subprocess.run(["/usr/bin/usdcat", usda_path, "-o", usdc_path],
                       check=True, capture_output=True)
        saida = os.path.abspath(destino)
        if os.path.exists(saida):
            os.remove(saida)
        # o usdzip resolve a textura pelo caminho relativo, entao roda de dentro
        subprocess.run(["/usr/bin/usdzip", saida] + nomes,
                       check=True, capture_output=True, cwd=tmp)
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


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
    ap.add_argument("--molduras", default="preta,branca,madeira")
    ap.add_argument("--meia-volta", action="store_true",
                    help="gira o usdz 180 graus (topo pro outro lado); sai com sufixo -alt")
    args = ap.parse_args()

    filtro = [s.strip() for s in args.so.split(",") if s.strip()]
    tams = [t.strip() for t in args.tamanhos.split(",") if t.strip()]
    molduras = [m.strip() for m in args.molduras.split(",") if m.strip()]
    for m in molduras:
        if m not in MOLDURAS:
            sys.exit("moldura desconhecida: %s (tem %s)" % (m, ", ".join(MOLDURAS)))
    os.makedirs(args.saida, exist_ok=True)

    veio = textura_madeira()
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
        nome_madeira = "madeira.jpg"
        for tam in tams:
            w, h = TAMANHOS[tam]
            sufixo = "-alt" if args.meia_volta else ""
            for moldura in molduras:
                base = os.path.join(args.saida, "%s-%s-%s%s" % (pid, tam, moldura, sufixo))
                tem_madeira = MOLDURAS[moldura].get("textura")
                madeira = veio if tem_madeira else None

                glb = montar_glb(w, h, jpeg, moldura, madeira)
                with open(base + ".glb", "wb") as fh:
                    fh.write(glb)

                usda = montar_usda(w, h, nome_textura, moldura,
                                   nome_madeira if tem_madeira else None, args.meia_volta)
                extras = {nome_madeira: madeira} if tem_madeira else None
                if not montar_usdz_apple(usda, jpeg, nome_textura, base + ".usdz", extras):
                    with open(base + ".usdz", "wb") as fh:
                        fh.write(montar_usdz(usda, jpeg, nome_textura))
                total += 2
            print("%-18s %s  %s  glb %5.0f KB   usdz %5.0f KB"
                  % (pid, tam, "/".join(molduras), len(glb) / 1024,
                     os.path.getsize(base + ".usdz") / 1024))
        manifesto[pid] = {"tamanhos": tams, "molduras": molduras}

    # o site le isto pra saber quem tem modelo; poster novo entra sozinho
    with open(os.path.join(args.saida, "manifesto.json"), "w") as fh:
        json.dump({"posteres": manifesto, "molduras": molduras,
                   "padrao": MOLDURA_PADRAO, "gerado_em": time.strftime("%Y-%m-%d")}, fh)
    print("\n%d arquivos + manifesto em %s/" % (total, args.saida))


if __name__ == "__main__":
    main()
