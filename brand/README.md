# Marca — Andrade

Logo padrão (versão **2a**): um "A" em traço verde com um ponto âmbar dentro.
Vale para este site e para todo material novo ou atualizado.

## Arquivos

| Arquivo | Uso |
|---|---|
| `logo-2a.svg` | Logo sem fundo, para fundos escuros (cabeçalho, rodapé, slides escuros). |
| `logo-2a-fundo.svg` | Logo sobre tile escuro com cantos arredondados: favicon, ícone de app, avatar. |
| `logo-2a-{32,64,256,512,1024}.png` | Logo sem fundo em PNG. |
| `logo-2a-fundo-{512,1024}.png` | Logo com tile em PNG. |

## Valores

- Verde do "A": `#39FF7A`
- Ponto: `#E3A92B`
- Tile (versão com fundo): `#261F3D`, cantos `rx=22` em viewBox 100×100
- Geometria (viewBox `0 0 100 100`): traço `M22 82 L50 18 L78 82`, largura 13, pontas e junta arredondadas; círculo `cx=50 cy=61 r=9`

## Regras

- Não recolorir, não esticar, não trocar o ponto por outro elemento.
- Não usar o asterisco do tema Vesper como marca. Ele é só ornamento (ex.: ícone do FAQ).
- Tamanho mínimo: 16 px. No cabeçalho do site: 1,7 rem.
- Favicon e ícones: sempre a versão com fundo.

## Markup inline (sem arquivo externo)

```html
<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M22 82 L50 18 L78 82" fill="none" stroke="#39FF7A" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="61" r="9" fill="#E3A92B"/></svg>
```

Com tile (favicon):

```html
<svg viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#261F3D"/><path d="M22 82 L50 18 L78 82" fill="none" stroke="#39FF7A" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="61" r="9" fill="#E3A92B"/></svg>
```

## Observação

Os dois SVGs originais trazem um bloco de metadados C2PA de cerca de 8 KB.
Nas páginas usa-se o markup inline acima, que é só a geometria do desenho.
