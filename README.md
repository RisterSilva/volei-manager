# 🏐 Vôlei Manager

Sistema de gerenciamento completo para peladas de vôlei: cadastro de jogadores, controle de presença, sorteio de times balanceados, três modos de rodízio, placar ao vivo e estatísticas detalhadas.  
Criado para transformar a organização do grupo em diversão e maturidade tática.

## ✨ Por que ele existe?

Após uma reformulação no número de jogadores e equipes do nosso grupo de vôlei, enfrentamos desafios clássicos:

- Times desequilibrados gerando partidas desinteressantes.
- Confusão sobre quem joga contra quem e em que ordem.
- Falta de histórico para acompanhar a evolução de cada atleta.
- Rodízios improvisados que causavam longas esperas.

O **Vôlei Manager** resolve isso com algoritmos inteligentes de balanceamento, modos de rodízio flexíveis e uma interface que funciona direto no navegador, sem precisar instalar nada.

## 🚀 Funcionalidades

- **Elenco**  
  Cadastro de jogadores com nome, nível (1 a 5) e sexo. Visualização em cards com badges e indicadores de presença.
  
- **Presença**  
  Controle rápido de quem está presente ou ausente, com filtros e métricas em tempo real.

- **Times**  
  Sorteio balanceado com distribuição inteligente de gêneros e níveis, respeitando "âncoras" (jogadores nível ≥4).  
  Ajuste manual após o sorteio, reordenação de times e visualização personalizável (estrelas, média, âncora).

- **Rodízio (3 modos)**  
  1. **Fila Dinâmica (Trava 2)** – O vencedor permanece, após duas vitórias seguidas o time descansa.  
  2. **Copa Relâmpago** – Fase de grupos, semifinais e final, com número de partidas configurável.  
  3. **Round‑Robin** – Todos contra todos (ida e volta), com sequência equilibrada de jogos.

- **Placar**  
  Placar interativo com somatório de pontos, finalização automática ao atingir a pontuação configurada e histórico das partidas.

- **Estatísticas**  
  Ranking de times (vitórias/derrotas, sequências de jogos e descansos), estatísticas individuais de jogadores e log de auditoria de todas as ações.

- **Torneio**  
  Geração simples de chaveamento a partir dos resultados atuais.

- **Importação / Exportação**  
  Importação de jogadores via arquivo Excel/CSV (com modelo disponível) e exportação de dados do elenco e times.

- **Persistência local**  
  Todo o estado é salvo automaticamente no `localStorage` do navegador – você não perde nada ao fechar a página.

## 📁 Estrutura do projeto

volei-manager/
├── index.html ← Estrutura da interface e modais
├── style.css ← Design system completo (variações, temas, responsivo)
├── script.js ← Lógica de negócio, rodízios e persistência
├── README.md ← Documentação do projeto


## 🖥️ Como executar

1. Faça o download ou clone este repositório.
2. Abra a pasta `Gerenciador_Peladas`.
3. Dê um duplo clique no arquivo `index.html`.
4. O sistema será carregado no seu navegador padrão – **não é necessário servidor local**.

> **Dica:** Para uma melhor experiência, utilize um navegador atualizado (Chrome, Edge, Firefox). O sistema foi projetado para ser responsivo, funcionando bem em desktops e tablets.

## ⚙️ Tecnologias

- HTML5, CSS3, JavaScript (ES6+)
- [SheetJS](https://sheetjs.com/) (leitura/escrita de Excel) – via CDN
- [Google Fonts](https://fonts.google.com/) (DM Sans e DM Mono)
- Nenhuma dependência de frameworks ou build tools – puro vanilla

## 📸 Capturas de tela

> Em breve! Quer contribuir com imagens? Pull requests são bem-vindos.

## 🤝 Contribuindo

Sugestões, correções e novas ideias são muito bem-vindas.  
Sinta-se à vontade para abrir uma [issue](../../issues) ou enviar um pull request.

Antes de contribuir com código, por favor:
- Respeite o estilo de código existente (ES6, vanilla JS).
- Teste localmente abrindo o `index.html` diretamente.

## 📄 Licença

Em resumo: use como quiser, apenas mantenha os créditos.

---

Feito com ❤️ para nossa pelada – e para a sua também!  
**Vôlei Manager** – equilíbrio, diversão e maturidade em quadra.
