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
| `--mono`     | Clother      | Alias de Clother para labels tecnicos (Space Mono descontinuada) |

Pesos Clother disponíveis: 400, 700, 900 (Black), 400 italic.

## Espaçamento

| Token CSS         | Valor                      | Uso               |
|-------------------|----------------------------|-------------------|
| `--gutter`        | `clamp(16px, 2vw, 32px)`   | Gap entre colunas |
| `--margem`        | `clamp(20px, 4vw, 56px)`   | Padding lateral   |
| `--secao-padding` | `clamp(56px, 9vh, 120px)`  | Padding vertical  |

## Componentes

### Rádio (`components/radio/`)

Botão de rádio no header (`#mr-btn`): speaker de pontos (4×2), display `88.5 FM` / `NO AR` e um LED. Ao ligar, abre o painel `#mr-drop` com o embed do Spotify da playlist MARATU e toca um efeito de estática (WebAudio) na transição ligar/desligar. Fecha ao clicar fora.

**Arquivos:**
- `components/radio/radio.css?v=7` — estilos com tokens do design system
- `components/radio/radio.js?v=5` — toggle + embed Spotify + estática WebAudio
- `components/radio/radio.html` — snippet HTML de referência

**Playlist Spotify:** `1JwBGozDx60NsCv4e4oalJ`

**Estrutura (no index):**
```html
<!-- no header -->
<button class="btn-radio" id="mr-btn" aria-expanded="false">
  <div class="mr-btn-speaker">…8 pontos…</div>
  <div class="mr-btn-display" id="mr-display">88.5 FM</div>
  <span class="mr-btn-led"></span>
</button>

<!-- painel, antes dos scripts -->
<div class="mr-drop" id="mr-drop"><div class="mr-drop-inner" id="mr-drop-inner"></div></div>
```

**Estados:** desligado mostra `88.5 FM`; ligado mostra `NO AR`, LED aceso e painel Spotify visível.

**Tokens em uso:** `--dourado` / `--laranja` (fundo), `--preto` (bordas/sombras), `--areia` (dots), `--clother` (base).

### Mascote Aratu

Caranguejo SVG (`data-aratu`) no footer do index. Anda pelo rodapé, foge do mouse/toque e pisca os olhos.

**Arquivos:**
- CSS inline no próprio `index.html` (bloco `/* aratu-mascote inline */`) — o antigo `aratu-mascote.css` foi removido por ser órfão.
- `aratu-mascote.js?v=8` — animação (caminhada, fuga do cursor, piscada).
