# DOUTRINA DE DESENVOLVIMENTO: EXECUÇÃO AUTÔNOMA E HOT RELOAD AO VIVO

> **Status:** CANÔNICO & INEGOCIÁVEL  
> **Aplica-se a:** Qualquer agente de IA ou desenvolvedor atuando no repositório `caloteoff` (Irineu).

---

## 1. Princípio Fundamental de Trabalho com o Usuário

O usuário deste projeto é o **testador de produto e experiência (UX/UI)**.

### Regras Absolutas:
1. **O usuário NUNCA roda comandos:** Não mande o usuário abrir terminal, rodar comandos (`npm run dev`, `adb`, etc.), configurar portas ou instalar ferramentas para testar alterações. O agente opera 100% da máquina e das ferramentas.
2. **O usuário manda "Ligar" e "Desligar":**
   - Quando o usuário disser *"roda o projeto"*, *"liga o app"*, *"inicia o emulador"*, o **agente** executa todo o processo e entrega o app aberto na tela do usuário.
   - Quando o usuário disser *"desliga"*, *"para o emulador"*, *"fecha tudo"*, o **agente** encerra os processos em background e o emulador de forma limpa.
3. **Hot Reload / Fast Refresh Instantâneo é Obrigatório:**
   - Toda alteração de tela, cor, texto, espaçamento, validação ou regra deve ser refletida **imediatamente e ao vivo** no emulador via Metro Bundler (Fast Refresh).
   - **NUNCA** faça o usuário esperar a compilação de um APK de Release (`gradlew assembleRelease` leva minutos) apenas para ver um ajuste visual.
   - O fluxo de Release / APK de produção (DoD) é reservado **exclusivamente** para quando o usuário disser explicitamente *"publique"*, *"gere a versão"* ou *"faça a release"*.

---

## 2. Passo a Passo Técnico para LIGAR o Ambiente de Desenvolvimento

Sempre que o usuário solicitar para rodar o app, execute a seguinte sequência autônoma:

### Passo 1: Iniciar o Emulador Android na Resolução Ideal
Inicie o emulador em processo separado com GUI para o usuário poder interagir na tela do notebook:

```powershell
cmd /c "start \"\" \"C:\Android\sdk\emulator\emulator.exe\" -avd CaloteOff_Pixel -no-skin -scale 0.5 -gpu host"
```

### Passo 2: Aguardar o Boot Completo do Android
Aguarde o emulador estar pronto antes de enviar conexões ou comandos:

```powershell
& "C:\Android\sdk\platform-tools\adb.exe" wait-for-device
while ((& "C:\Android\sdk\platform-tools\adb.exe" shell getprop sys.boot_completed).Trim() -ne "1") {
    Start-Sleep -Seconds 2
}
```

### Passo 3: Configurar o Redirecionamento de Portas (Metro)
Garanta que a porta 8081 do emulador esteja conectada à máquina hospedeira:

```powershell
& "C:\Android\sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

### Passo 4: Iniciar o Servidor Expo (Metro Bundler) em Background
Inicie o servidor de desenvolvimento Expo na pasta do projeto com `IsDaemon: true`:

```powershell
# No diretório C:\Users\Particular\Documents\caloteoff
npm run dev
# ou: npx expo start
```

### Passo 5: Abrir o Aplicativo no Emulador
Com o Metro bundler ativo e o dispositivo conectado, inicie o app no celular:

```powershell
& "C:\Android\sdk\platform-tools\adb.exe" shell monkey -p com.particular.caloteoff -c android.intent.category.LAUNCHER 1
```

*(Caso o Metro esteja rodando no terminal com suporte a input, enviar a tecla `a` conecta o client do Android automaticamente).*

---

## 3. Fluxo de Trabalho com Hot Reload

1. Enquanto o Metro Bundler estiver em execução, qualquer edição salva em arquivos `src/**/*.tsx` ou `src/**/*.ts` é compilada em milissegundos e atualizada na tela do emulador do usuário.
2. Não reinicie o servidor Metro a menos que tenham sido alteradas dependências nativas (`package.json`) ou o `app.json`.
3. Mantenha os logs limpos e informe ao usuário quando a tela já estiver atualizada para ele testar.

---

## 4. Passo a Passo Técnico para DESLIGAR o Ambiente

Quando o usuário pedir para parar, desligar ou encerrar a sessão de testes:

### Passo 1: Encerrar a Tarefa do Expo / Metro Bundler
Identifique o background task do `npm run dev` / `expo start` via `manage_task(Action='list')` e encerre com `manage_task(Action='kill', TaskId=...)`.

### Passo 2: Desligar o Emulador Android
Envie o sinal limpo de desligamento para o emulador via ADB:

```powershell
& "C:\Android\sdk\platform-tools\adb.exe" emu kill
```

Se o processo persistir:
```powershell
Stop-Process -Name "emulator", "qemu-system-x86_64" -Force -ErrorAction SilentlyContinue
```

---

## 5. Resumo da Responsabilidade do Agente

- O usuário **olha e testa** o aplicativo no celular emulado.
- O agente **sobe, configura, edita o código, monitora e derruba** toda a infraestrutura.
- Nenhuma barreira técnica deve ser transferida para o usuário durante o ciclo de design e desenvolvimento.
