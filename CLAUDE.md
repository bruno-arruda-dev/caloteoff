# CLAUDE.md — CaloteOff

Consulte e respeite as diretrizes universais e invariantes contábeis definidas em [`AGENTS.md`](AGENTS.md).

## Definition of Done (DoD) & Release Workflow

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
