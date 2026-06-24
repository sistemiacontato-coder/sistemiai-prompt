# PRD — Máquina de Geração de Prompts
**Produto:** Prompt Machine / BotConversa  
**Objetivo:** Sistema que gera, testa, corrige e refina prompts de agentes de IA com velocidade e precisão — eliminando o ciclo artesanal de edição manual.

---

## Problema

O ciclo atual é:

> Edita → Gera → Testa na mão → Percebe erro → Ajusta → Repete

Esse ciclo é lento, depende de memória humana, não escala para múltiplos agentes e não detecta regressões quando uma mudança quebra algo que funcionava.

---

## Visão

> Edita → Gera → Bateria roda → Sistema mostra onde falhou → Corrige cirurgicamente → Sistema reroda → Passa → Salva automaticamente

Um engenheiro de prompt deve poder criar e validar um agente completo em minutos, não em horas.

---

## Estado Atual (Fundação Pronta)

| Funcionalidade | Status |
|---|---|
| Editor baseado em config (não texto cru) | ✅ |
| Gerador de prompt (`promptBuilder`) | ✅ |
| Patches cirúrgicos (`domain_add/remove`, `persona_add/remove`) | ✅ |
| Checkboxes individuais no painel de diff | ✅ |
| Auditor de prompt | ✅ |
| Simulador manual com ajuste via IA | ✅ |
| Auto-save após aplicar mudanças | ✅ |
| Histórico de versões | ✅ |
| Terminologia unificada (objetivo, não domínio) | ✅ |

---

## Fases de Implementação

---

### FASE 1 — Geração Automática de Cenários de Teste
**Objetivo:** Eliminar a criação manual de casos de teste.

**O que faz:**  
A IA lê o objetivo do agente e suas saídas e gera automaticamente cenários de teste realistas. Cada cenário tem um objetivo do cliente (o que ele quer resolver) e uma sequência de mensagens inicial.

**Funcionalidades:**
- [ ] Botão "Gerar cenários" no simulador
- [ ] IA analisa: objetivo do agente + saídas configuradas + persona
- [ ] Gera N cenários cobrindo: fluxos principais, casos de borda, saídas específicas
- [ ] Cada cenário tem: nome, objetivo do cliente, mensagens iniciais, saída esperada
- [ ] Usuário pode editar, salvar ou descartar cada cenário gerado
- [ ] Cenários ficam salvos na config do agente (não em estado volátil)

**Critério de sucesso:** Criar 8 cenários relevantes para o agente em menos de 30 segundos, sem escrever nenhum manualmente.

---

### FASE 2 — Execução em Lote com Resultado por Passo
**Objetivo:** Ver todos os cenários rodando de uma vez, com falha apontada por mensagem.

**O que faz:**  
Roda todos os cenários salvos em paralelo contra o prompt atual. Mostra quais passaram, quais falharam e em qual passo específico cada falha aconteceu.

**Funcionalidades:**
- [ ] Botão "Rodar bateria" no simulador
- [ ] Executa todos os cenários salvos com o modelo e temperatura configurados
- [ ] Painel de resultados: lista de cenários com ícone ✅ / ❌
- [ ] Ao clicar num cenário com falha: abre a conversa completa
- [ ] Passo com falha fica destacado (mensagem esperada vs mensagem recebida)
- [ ] Indicador de cobertura: quais saídas têm cenários cobrindo elas
- [ ] Tempo de execução e custo estimado visíveis antes de rodar

**Critério de sucesso:** Ver em uma tela quais dos 10 cenários passaram e qual mensagem específica está errada no que falhou.

---

### FASE 3 — Correção por Passo e Replay Dinâmico
**Objetivo:** Corrigir o prompt apontando o passo errado, sem reexecutar tudo do zero.

**O que faz:**  
Usuário clica em um passo com falha, aponta o que estava errado, o sistema sugere um ajuste cirúrgico no prompt e reroda a conversa a partir daquele passo — com cliente simulado dinâmico (não script fixo).

**Funcionalidades:**
- [ ] Botão "Corrigir daqui" em qualquer mensagem da conversa
- [ ] Painel lateral: "O que estava errado?" + campo para instrução
- [ ] Sistema gera patch cirúrgico no objetivo/persona com base no erro apontado
- [ ] Replay a partir do passo corrigido: histórico anterior congelado
- [ ] Cliente simulado dinâmico a partir do ponto de correção
  - Tem um objetivo fixo (o que o cliente quer resolver)
  - Gera suas mensagens baseado na resposta mais recente do agente
  - Não segue script — adapta ao novo comportamento do agente
- [ ] Resultado: conversa reconstruída do passo 5 em diante com o prompt corrigido
- [ ] Diff da conversa: antes vs depois da correção

**Critério de sucesso:** Corrigir o passo 5 de um cenário de 10 mensagens e ver a conversa se reconstruir organicamente a partir dali em menos de 1 minuto.

---

### FASE 4 — Detecção de Regressão
**Objetivo:** Garantir que uma mudança no prompt não quebra o que já funcionava.

**O que faz:**  
Sempre que uma mudança é aplicada ao prompt, o sistema reroda automaticamente os cenários salvos e mostra se algum cenário que passava antes agora falha.

**Funcionalidades:**
- [ ] Após aplicar qualquer mudança (via revisor, auditor ou manual): oferecer "Verificar regressão"
- [ ] Reroda todos os cenários salvos com o novo prompt
- [ ] Compara com resultados anteriores: passou antes / falha agora = regressão detectada
- [ ] Alerta claro: "2 cenários que passavam agora falham"
- [ ] Permite aplicar ou reverter a mudança com base no resultado
- [ ] Histórico de execuções: qual prompt gerou quais resultados

**Critério de sucesso:** Aplicar uma mudança de prompt e saber em 60 segundos se ela quebrou algum cenário previamente validado.

---

### FASE 5 — Gestão de Suite de Testes
**Objetivo:** Tratar os cenários como ativos do agente, não como estado temporário.

**O que faz:**  
Os cenários de teste fazem parte da config do agente, versionados junto com o prompt. Podem ser exportados, importados, duplicados entre agentes.

**Funcionalidades:**
- [ ] Cenários salvos no Supabase junto com a config do agente
- [ ] CRUD completo: criar, editar, duplicar, arquivar cenários
- [ ] Tag por tipo: fluxo principal, caso de borda, regressão, saída específica
- [ ] Marcar cenário como "obrigatório" (sempre roda) ou "opcional"
- [ ] Exportar suite como JSON
- [ ] Importar cenários de outro agente (reaproveitamento)
- [ ] Ver cobertura: % das saídas cobertas por pelo menos um cenário

**Critério de sucesso:** Abrir um agente existente e ver sua suite de testes completa pronta para rodar, versionada junto com o prompt.

---

## Princípios de Implementação

1. **Uma fase por vez** — cada fase tem critério de sucesso claro antes de avançar
2. **Testar com o agente real** — Melissa é o agente piloto para validar cada fase
3. **Custo visível** — o usuário sempre sabe quantas chamadas de IA vai fazer antes de rodar
4. **Nunca bloquear** — se a bateria falhar, o usuário pode continuar editando normalmente
5. **Patches cirúrgicos sempre** — nenhuma automação substitui texto completo de config

---

## O que NÃO está no escopo

- Multi-agente (testar handoff entre agentes) — fase futura
- Avaliação semântica automática de qualidade da resposta — depende de critério externo
- Deploy automático baseado em resultado de testes — risco alto, requer confirmação humana
- Integração direta com BotConversa para capturar conversas reais — fase futura

---

## Próximo Passo

**Iniciar pela Fase 1:** geração automática de cenários.  
É a que tem maior retorno imediato e menor risco — não altera nada no fluxo atual, apenas adiciona conteúdo ao simulador existente.
