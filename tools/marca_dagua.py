#!/usr/bin/env python3
"""A marca d'agua da MARATU, em Python.

Existe uma segunda implementacao da MESMA marca no navegador, em
admin-imagens.js, que roda no upload do admin. As duas leem a mesma tabela de
constantes (ESPEC) — se mexer aqui, mexa la tambem, senao imagem velha e
imagem nova saem com marcas diferentes.

Desenho: "maratu" em Jack, ladrilhado na diagonal, bem apagado, mais uma
assinatura discreta no canto. Jack so aparece no nome da marca, como manda a
identidade; o dominio vai em Clother.
"""
import os

from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JACK = os.path.join(RAIZ, "TRYJackAlpha-Regular.ttf")
CLOTHER = os.path.join(RAIZ, "TRYClother-Bold.ttf")

# Fracoes da largura da imagem, pra marca ficar igual em qualquer tamanho.
ESPEC = {
    "largura": 1400,       # a variante com marca e maior que a do card
    "qualidade": 82,
    "texto": "maratu",
    "corpo": 0.075,        # corpo da fonte
    "giro": -30,           # graus
    "passo_x": 2.30,       # espacamento horizontal, em larguras do texto
    "passo_y": 4.20,       # espacamento vertical, em corpos de fonte
    "alfa_claro": 0.11,    # o branco que aparece sobre arte escura
    "alfa_escuro": 0.09,   # o preto que aparece sobre arte clara
    "desloca": 0.055,      # sombra do preto, em corpos de fonte
    "canto_texto": "maratu.com.br",
    "canto_corpo": 0.021,
    "canto_alfa": 0.42,
    "canto_margem": 0.030,
}


def _tile(w, h, e):
    """Camada RGBA so com o ladrilho diagonal, do tamanho da imagem."""
    corpo = max(12, round(w * e["corpo"]))
    fonte = ImageFont.truetype(JACK, corpo)
    d0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    larg_txt = d0.textlength(e["texto"], font=fonte)
    passo_x = max(1, round(larg_txt * e["passo_x"]))
    passo_y = max(1, round(corpo * e["passo_y"]))
    desl = max(1, round(corpo * e["desloca"]))

    # sobra pra sobrar imagem depois do giro
    lado = int((w + h) * 1.15)
    camada = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    claro = (255, 255, 255, round(255 * e["alfa_claro"]))
    escuro = (13, 13, 11, round(255 * e["alfa_escuro"]))
    linha = 0
    for y in range(-passo_y, lado + passo_y, passo_y):
        # cada linha entra meio passo deslocada, pra nao virar grade quadriculada
        base_x = -passo_x + (passo_x // 2 if linha % 2 else 0)
        for x in range(base_x, lado + passo_x, passo_x):
            d.text((x + desl, y + desl), e["texto"], font=fonte, fill=escuro)
            d.text((x, y), e["texto"], font=fonte, fill=claro)
        linha += 1

    camada = camada.rotate(e["giro"], resample=Image.BICUBIC)
    esq = (lado - w) // 2
    topo = (lado - h) // 2
    return camada.crop((esq, topo, esq + w, topo + h))


def _canto(im, e):
    w, h = im.size
    corpo = max(9, round(w * e["canto_corpo"]))
    fonte = ImageFont.truetype(CLOTHER, corpo)
    camada = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    larg = d.textlength(e["canto_texto"], font=fonte)
    margem = round(w * e["canto_margem"])
    x = w - larg - margem
    y = h - corpo - margem
    desl = max(1, round(corpo * 0.09))
    d.text((x + desl, y + desl), e["canto_texto"], font=fonte,
           fill=(13, 13, 11, round(255 * e["canto_alfa"] * 0.7)))
    d.text((x, y), e["canto_texto"], font=fonte,
           fill=(255, 255, 255, round(255 * e["canto_alfa"])))
    return camada


def aplicar(im, espec=None):
    """Recebe uma PIL.Image, devolve RGB ja redimensionada e marcada."""
    e = dict(ESPEC, **(espec or {}))
    im = im.convert("RGB")
    if im.width > e["largura"]:
        nova = (e["largura"], round(im.height * e["largura"] / im.width))
        im = im.resize(nova, Image.LANCZOS)
    w, h = im.size
    im = im.convert("RGBA")
    im = Image.alpha_composite(im, _tile(w, h, e))
    im = Image.alpha_composite(im, _canto(im, e))
    return im.convert("RGB")


if __name__ == "__main__":
    import sys
    entrada, saida = sys.argv[1], sys.argv[2]
    aplicar(Image.open(entrada)).save(saida, "WEBP", quality=ESPEC["qualidade"], method=6)
    print(saida, os.path.getsize(saida) // 1024, "KB")
