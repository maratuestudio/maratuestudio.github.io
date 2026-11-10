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

## Fundamentos (regras de construção)

Valem para toda página e componente novo. Trecho antigo se ajusta quando for mexido.

### Cor em OKLCH

O hex é a fonte. OKLCH serve para derivar estado e escala sem mudar a claridade aparente.

| Token CSS        | OKLCH                       |
|------------------|-----------------------------|
| `--laranja`      | `oklch(0.583 0.165 41.2)`   |
| `--dourado`      | `oklch(0.715 0.147 78.7)`   |
| `--azul`         | `oklch(0.335 0.118 261.0)`  |
| `--azul-claro`   | `oklch(0.545 0.148 256.5)`  |
| `--areia`        | `oklch(0.944 0.012 84.6)`   |
| `--areia-sombra` | `oklch(0.905 0.017 84.6)`   |
| `--preto`        | `oklch(0.158 0.004 106.9)`  |

- Estado derivado: `oklch(from var(--laranja) calc(l - 0.06) c h)`.
- Mistura: `color-mix(in oklch, var(--areia), var(--preto) 12%)`.
- Gradiente: `linear-gradient(in oklch, ...)`.

### Tipo

- Tracking em `em`: título grande de -0.01em a -0.03em, corpo 0, caixa alta e texto de 12 px ou menos de +0.04em a +0.1em.
- `line-height` sem unidade: corpo de 1.4 a 1.6, título de 1.0 a 1.2.
- Texto corrido com `max-width: 65ch`.
- Título com `text-wrap: balance`; parágrafo curto com `text-wrap: pretty`.
- Número que muda ou alinha em coluna: `font-variant-numeric: tabular-nums` (a Clother tem `tnum`).
- Kerning ligado (padrão). Par ruim em título se corrige no vetor, nunca com `letter-spacing`.

### Layout e toque

- Alvo de toque de 44x44 px, com 8 px até o vizinho, aumentado por `padding`. Nunca por pseudo-elemento.
- Barra, rodapé e botão fixos com `env(safe-area-inset-*)`.
- Toda imagem, vídeo e iframe com `width` e `height` ou `aspect-ratio`. Nada entra acima do conteúdo já visto.
- Todo interativo com repouso, hover, `:focus-visible`, pressionado e desabilitado. Hover dentro de `@media (hover: hover) and (pointer: fine)`.

### Motion

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* entra e sai */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* move na tela */
```

- Pressionar de 100 a 160 ms; menu de 150 a 250; modal e gaveta de 200 a 500. Interface abaixo de 300 ms.
- Só `transform` e `opacity`. Sem `transition: all`, sem `ease-in`, sem `scale(0)`.
- Troca de estado por `transition` (interrompível). `@keyframes` só para sequência que roda uma vez.
- Menu, popover e tooltip abrem a partir do gatilho (`transform-origin`). Modal abre do centro.
- Cascata: de 30 a 80 ms entre itens, uma por página, só em entrada rara.
- Miniatura que vira foto da página: `view-transition-name` único e `@view-transition { navigation: auto; }` nas duas páginas.
- `prefers-reduced-motion`: sem movimento, com opacidade e cor.

## Componentes

### Rádio (`components/radio/`)

Botão de rádio no header (`#mr-btn`): speaker de pontos (4×2), display `88.5 FM` / `NO AR` e um LED. Ao ligar, abre o painel `#mr-drop` com o embed do Spotify da playlist MARATU e toca um efeito de estática (WebAudio) na transição ligar/desligar. Fecha ao clicar fora.

**Arquivos:**
- `components/radio/radio.css?v=8` — estilos com tokens do design system
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
