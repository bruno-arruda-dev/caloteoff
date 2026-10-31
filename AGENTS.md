# AGENTS.md — CaloteOff

This is an Expo/React Native mobile application for controlling credit sales ("vendas fiadas") and active collection ("cobrança ativa"). Prioritize mobile-first patterns, offline-first reliability, and clean UX.

## 1. Princípios do Produto e A "Regra das Duas Caras"

- **Dentro do App (Visão do Lojista):** Linguagem 100% popular, direta e sem termos contábeis engessados ("Pendurar", "Passar a régua", "Abater", "Tá devendo", "Tá em dia", "Cobrar no Zap").
- **Fora do App (Mensagens, Recibos e PDFs ao Cliente Final):** Comunicação polida, educada e profissional. O nome "CaloteOff" **NUNCA** aparece em mensagens, comprovantes ou faturas em PDF (White Label da loja credora).

## 2. Invariantes Contábeis & Regras de Saldo

1. **Equação Contínua da Conta-Corrente:**
   $$\text{Saldo} = \sum(\text{Débitos Pendentes}) - \text{Crédito Restante}$$
   - **Saldo Devedor (Vermelho):** $\text{Saldo} > 0$. O cliente deve para a loja.
   - **Saldo Zerado (Verde/Cinza):** $\text{Saldo} = 0$. Conta liquidada.
   - **Saldo Credor / A Favor (Azul):** $\text{Saldo} < 0$. O cliente pagou a mais ou adiantou valor. Novos débitos consomem automaticamente o saldo a favor.
2. **Snapshot Imutável em Liquidações ("Passar a Régua"):**
   - Toda baixa registra: `saldo_anterior`, `valor_liquidado`, `saldo_posterior`, `data_hora_registro`.
   - Permite o reenvio de comprovantes fiéis ao momento histórico da baixa.
3. **Limite de Fiado e Políticas de Estouro:**
   - `AVISAR_E_PERMITIR`: Alerta o lojista sobre o risco, mas permite salvar se confirmado.
   - `BLOQUEAR_TOTAL`: Impede o salvamento enquanto o valor exceder o teto estipulado.
4. **Doutrina Sagrada de Backup & Migrations:**
   - Documento canônico: [`docs/doctrine/DOUTRINA_BACKUP_MIGRATIONS.md`](docs/doctrine/DOUTRINA_BACKUP_MIGRATIONS.md).
   - Backups antigos NUNCA podem ser rejeitados ou quebrar. Toda alteração de schema exige migração sequencial pura (`V_antiga -> V_nova`) com retrocompatibilidade garantida e testes unitários dedicados.
   - Suporte modular obrigatório: Backup Completo (`FULL`), Apenas Pendências (`PENDING_ONLY`) e Arquivo Morto/Consolidado (`CONSOLIDATED_ARCHIVE`).

## 3. Definition of Done (DoD) & Release Workflow

Sempre que concluir o desenvolvimento de uma funcionalidade, ajuste ou correção neste projeto (`caloteoff`), finalize a tarefa executando o ciclo completo de entrega contínua:

1. **Validação de Qualidade:**
   - Execute a tipagem estrita: `cmd /c "cd C:\Users\Particular\Documents\caloteoff && npx tsc --noEmit"`
   - Execute os testes automatizados: `cmd /c "cd C:\Users\Particular\Documents\caloteoff && npx vitest run"`
   - Não prossiga se houver erros de compilação ou testes reprovados.

2. **Incremento de Versão (SemVer):**
   - Suba a versão nos 3 arquivos sincronizados:
     - `package.json`: incremente `"version"` (ex: `1.0.0` -> `1.0.1`)
     - `app.json`: incremente `"version"` e adicione +1 em `"versionCode"` (ex: `1` -> `2`)
     - `android/app/build.gradle`: incremente `versionName` e adicione +1 em `versionCode`

3. **Compilação do APK de Release:**
   - Compile localmente com as variáveis de ambiente necessárias:
     ```powershell
     $env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'; $env:ANDROID_HOME = 'C:\Android\sdk'; $env:Path = "$env:JAVA_HOME\bin;" + $env:Path; Set-Location 'C:\Users\Particular\Documents\caloteoff\android'; .\gradlew.bat assembleRelease
     ```
   - Copie o APK gerado para a raiz do projeto:
     ```powershell
     Copy-Item 'C:\Users\Particular\Documents\caloteoff\android\app\build\outputs\apk\release\app-release.apk' 'C:\Users\Particular\Documents\caloteoff\caloteoff.apk' -Force
     ```

4. **Commit, Push e Publicação da Release no GitHub:**
   - Faça o commit e push na branch `main`:
     ```powershell
     Set-Location 'C:\Users\Particular\Documents\caloteoff'; git add .; git commit -m 'feat/fix: descrição da alteração'; git push origin main
     ```
   - Publique a Release no GitHub anexando o APK gerado:
     ```powershell
     Set-Location 'C:\Users\Particular\Documents\caloteoff'; gh release create vX.Y.Z caloteoff.apk --title "vX.Y.Z - Título da Release" --notes "Changelog detalhado das novidades"
     ```
   - Entregue ao usuário o resumo das alterações e o link direto da release no GitHub.
