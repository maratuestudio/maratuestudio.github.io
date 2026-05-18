# MARATU — Design System

## Paleta de cores

| Token CSS        | Hex       | Uso                         |
|------------------|-----------|-----------------------------|
| `--laranja`      | `#C8501A` | CTA, destaques, hover       |
| `--azul`         | `#0E3272` | Acento frio, badges         |
| `--azul-claro`   | `#2E6FC4` | Links, estados secundários  |
| `--areia`        | `#F0ECE4` | Fundo claro, texto sobre escuro |
| `--areia-sombra` | `#E5DFD3` | Bordas sobre areia          |
| `--preto`        | `#0D0D0B` | Texto, bordas, sombras      |
| `--dourado`      | `#D4960A` | Destaque premium, botões    |

## Tipografia

| Token CSS    | Família      | Uso                              |
|--------------|--------------|----------------------------------|
| `--jack`     | Jack         | Display, logotipo, títulos hero  |
| `--clother`  | Clother      | Corpo, UI labels, headings       |
| `--mono`     | Space Mono   | Dados técnicos, badges, displays |

Pesos Clother disponíveis: 400, 700, 900 (Black), 400 italic.

## Espaçamento

| Token CSS         | Valor                      | Uso               |
|-------------------|----------------------------|-------------------|
| `--gutter`        | `clamp(16px, 2vw, 32px)`   | Gap entre colunas |
| `--margem`        | `clamp(20px, 4vw, 56px)`   | Padding lateral   |
| `--secao-padding` | `clamp(56px, 9vh, 120px)`  | Padding vertical  |

## Componentes

### Rádio (`components/radio/`)

Widget de rádio fixo no canto inferior direito. Exibe player embed da playlist MARATU no Spotify ao ser ativado.

**Arquivos:**
- `components/radio/radio.css` — estilos com tokens do design system
- `components/radio/radio.js` — lógica toggle + embed Spotify
- `components/radio/radio.html` — snippet HTML de referência

**Playlist Spotify:** `1JwBGozDx60NsCv4e4oalJ`

**Incluir em cada página:**
```html
<!-- <head> -->
<link rel="stylesheet" href="components/radio/radio.css">

<!-- antes de </body> -->
<div class="maratu-radio" id="maratu-radio">...</div>
<script src="components/radio/radio.js" defer></script>
```

**Estados:**
- Desligado: fundo `--dourado`, display `88.5 FM`, label `DESLIGADO`
- Ligado (`.on`): fundo `--laranja`, display `NO AR`, label `TOCANDO`, painel Spotify visível

**Mobile (≤768px):** widget reduz para 160px de largura, painel ocupa `100vw - 30px` (max 320px).

**Tokens em uso:**
| Elemento            | Token           |
|---------------------|-----------------|
| Fundo (off)         | `--dourado`     |
| Fundo (on)          | `--laranja`     |
| Bordas / sombras    | `--preto`       |
| Speaker dots (on)   | `--areia`       |
| Display text (off)  | `--dourado`     |
| Brand font          | `--jack`        |
| UI labels           | `--mono`        |
| Base font           | `--clother`     |
