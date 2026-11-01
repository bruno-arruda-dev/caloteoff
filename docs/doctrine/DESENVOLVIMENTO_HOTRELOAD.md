# DOUTRINA DE DESENVOLVIMENTO: EXECUÇÃO AUTÔNOMA E HOT RELOAD AO VIVO

> **Status:** CANÔNICO & INEGOCIÁVEL  
> **Aplica-se a:** Qualquer agente de IA ou desenvolvedor atuando no repositório `caloteoff` (Irineu).

---

## 1. Princípio Fundamental de Trabalho com o Usuário

O usuário deste projeto atua exclusivamente como **testador de produto e experiência (UX/UI)**.

### Regras Absolutas:
1. **O usuário NUNCA roda comandos:** Não mande o usuário abrir terminal, rodar comandos (`npm run dev`, `npx expo`, etc.), configurar portas ou instalar ferramentas. O agente opera 100% da máquina e dos processos.
2. **O usuário comanda Ligar e Desligar:**
   - Quando o usuário disser *"roda o projeto"*, *"liga o app"*, *"sobe o ambiente"*, o **agente** assume tudo, inicia o Metro Bundler e disponibiliza o app pronto para teste.
   - Quando o usuário disser *"desliga"*, *"para o projeto"*, *"mata os processos"*, o **agente** encerra os processos em background de forma limpa.
3. **Hot Reload / Fast Refresh Instantâneo é Obrigatório:**
   - Toda alteração de tela, cor, texto, espaçamento, validação ou regra deve refletir **imediatamente e ao vivo** via Metro Bundler (Fast Refresh).
   - **NUNCA** faça o usuário esperar a compilação de um APK de Release (`gradlew assembleRelease` leva minutos) apenas para ver um ajuste visual.
   - O fluxo de Release / APK de produção (DoD) é reservado **exclusivamente** para quando o usuário disser explicitamente *"publique"*, *"gere a versão oficial"* ou *"faça a release"*.

---

## 2. Modos de Execução & Preferências do Usuário

O projeto oferece suporte a três modalidades de teste, com prioridades estritas:

### 🏆 Modo 1: Celular Físico via Expo Go (PREFERÊNCIA PRIMÁRIA)
- **Como o usuário testa:** Abre o aplicativo **Expo Go** no smartphone conectado na mesma rede Wi-Fi e escaneia o QR Code ou insere o link `exp://<IP-Local>:8081`.
- **Ação do Agente:**
  1. Identifica o IP local da máquina (`ipconfig` / Wi-Fi).
  2. Sobe o Expo em background:
     ```powershell
     npx expo start
     ```
  3. Informa a URL amigável (ex: `exp://192.168.1.11:8081`) para o usuário abrir no aparelho.

### 🌐 Modo 2: Navegador Web no PC (MODO WEB DESKTOP)
- **Quando usar:** Quando o usuário pedir expressamente para testar no computador / navegador ("roda no navegador", "abre no browser").
- **Ação do Agente:**
  1. Inicia o Metro com target web em background (`IsDaemon: true`):
     ```powershell
     npx expo start --web
     ```
  2. Dispara a abertura do navegador automaticamente:
     ```powershell
     Start-Process "http://localhost:8081"
     ```
  3. O usuário valida componentes e fluxos diretamente na aba do navegador com Fast Refresh.

### ⚠️ Modo 3: Emulador Android Local (DESENCORAJADO / APENAS SOB DEMANDA EXPLÍCITA)
- **Diretriz:** O emulador Android no Windows consome recursos excessivos e pode travar na inicialização com GPUs dedicadas ou aceleração de snapshot ("bugado").
- **Regra:** **NUNCA** inicie o emulador por conta própria. Apenas suba o emulador se o usuário pedir com todas as letras: *"abra no emulador Android"*.

---

## 3. Passo a Passo Técnico para LIGAR o Ambiente

### Para Celular Físico (Expo Go - Padrão):
```powershell
# No diretório C:\Users\Particular\Documents\caloteoff
cmd /c "cd /d C:\Users\Particular\Documents\caloteoff && npx expo start"
```

### Para Navegador Web:
```powershell
# No diretório C:\Users\Particular\Documents\caloteoff
cmd /c "cd /d C:\Users\Particular\Documents\caloteoff && npx expo start --web"
# Em seguida, abrir a página:
Start-Process "http://localhost:8081"
```

---

## 4. Passo a Passo Técnico para DESLIGAR o Ambiente

Quando o usuário pedir para parar, desligar ou encerrar a sessão de testes:

1. **Encerrar tarefas do Expo / Metro:**
   - Localize a tarefa em background via `manage_task(Action='list')`.
   - Cancele a tarefa via `manage_task(Action='kill', TaskId=...)`.
2. **Garantir liberação da porta 8081:**
   ```powershell
   Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
   ```
3. **Garantir que nenhum emulador residual fique rodando:**
   ```powershell
   Stop-Process -Name "emulator", "qemu-system-x86_64" -Force -ErrorAction SilentlyContinue
   ```

---

## 5. Resumo da Responsabilidade do Agente

- O usuário **olha e testa** o aplicativo no celular real ou navegador.
- O agente **sobe o Metro, monitora, edita o código com hot reload e encerra** os serviços.
- Nenhuma complexidade de terminal ou linha de comando deve ser repassada ao usuário.
