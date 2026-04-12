# Arquitetura VR Web Modular

## 1. Objetivo

Criar uma base única para experiências VR na web, com um **núcleo principal** e um sistema de **módulos plugáveis**.

Essa base deve permitir:

- iniciar sempre pelo mesmo projeto principal
- adicionar ou remover funcionalidades sem quebrar o restante
- separar responsabilidades entre núcleo e módulos
- reaproveitar código entre diferentes experiências VR
- tratar cada nova sala, sistema ou feature como um módulo independente

---

## 2. Visão geral

A arquitetura é dividida em 4 partes:

### 2.1 Core
É o núcleo da aplicação.

Responsável por:

- inicialização da aplicação
- criação da cena base
- gerenciamento de XR
- input
- estado global
- roteamento de cenas/salas
- eventos globais
- carregamento e descarregamento de módulos
- serviços compartilhados

### 2.2 SDK de módulos
É o contrato técnico usado por qualquer módulo.

Responsável por:

- definir a interface padrão
- padronizar lifecycle
- limitar o acesso ao core
- garantir previsibilidade

### 2.3 Módulos
São pacotes independentes que adicionam novas capacidades.

Exemplos:

- sala de treinamento
- inventário
- puzzle room
- multiplayer
- visão noturna
- painel de debug
- galeria 3D
- mapa

### 2.4 App Hub
É a experiência principal visível ao usuário.

Responsável por:

- servir como sala central
- listar módulos disponíveis
- abrir experiências
- ativar e desativar módulos
- exibir menu, status e navegação

---

## 3. Princípios de arquitetura

### 3.1 O core não conhece detalhes internos dos módulos
O core apenas sabe:

- como registrar módulos
- como ativar módulos
- como desativar módulos
- quais contratos o módulo implementa

### 3.2 O módulo nunca depende diretamente de estruturas privadas de outro módulo
Toda comunicação deve ocorrer por:

- eventos
- APIs públicas registradas
- estado compartilhado controlado

### 3.3 Cada módulo precisa ser carregável e descartável
O módulo deve conseguir:

- iniciar
- montar recursos
- desmontar recursos
- limpar memória, listeners e objetos 3D

### 3.4 Tudo que for global deve passar por serviços do core
Exemplo:

- audio
- assets
- input
- analytics
- save
- network
- ui

### 3.5 O projeto deve nascer pequeno
Primeiro objetivo:

- 1 hub
- 2 módulos de experiência
- 1 módulo de sistema

Só depois generalizar.

---

## 4. Stack recomendada

## 4.1 Base

- **Next.js** para shell da aplicação web
- **React** para composição
- **Three.js** para renderização 3D
- **React Three Fiber** para organizar a cena de forma componentizada
- **WebXR** para VR no navegador
- **Zustand** para estado global leve

## 4.2 Utilidades

- **TypeScript** para contratos rígidos
- **dynamic import** para carregamento sob demanda
- **Zod** para validar manifests/configs de módulos
- **EventEmitter leve** ou event bus próprio

## 4.3 Estrutura recomendada
Monorepo.

Porque facilita:

- separar core e módulos
- versionar pacotes
- criar SDK
- testar módulos isoladamente

---

## 5. Estrutura de pastas

```txt
vr-platform/
  apps/
    hub/
      src/
        app/
        ui/
        scenes/
        boot/

  packages/
    core/
      src/
        app/
        services/
        runtime/
        xr/
        scene/
        store/
        events/
        types/

    module-sdk/
      src/
        index.ts
        types.ts
        helpers.ts

    module-hub-world/
      src/
        manifest.ts
        index.ts
        scene/
        ui/

    module-training-room/
      src/
        manifest.ts
        index.ts
        scene/
        systems/
        ui/

    module-inventory/
      src/
        manifest.ts
        index.ts
        systems/
        ui/

  tooling/
    scripts/
    generators/

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

---

## 6. Tipos de módulo

## 6.1 Módulo de experiência
Responsável por entregar uma sala, ambiente ou fluxo principal.

Exemplo:

- showroom VR
- puzzle room
- sala de treino
- laboratório

Pode registrar:

- cenas
- interações
- interfaces próprias
- pontos de entrada no hub

## 6.2 Módulo de sistema
Responsável por acrescentar capacidade transversal.

Exemplo:

- inventário
- voz
- multiplayer
- achievements
- save local
- minimapa

Pode registrar:

- services
- stores
- listeners
- overlays
- hotkeys

## 6.3 Módulo híbrido
Mistura experiência com sistema.

Use pouco.

O ideal é separar para evitar acoplamento.

---

## 7. Contrato técnico do módulo

Cada módulo precisa seguir uma interface única.

```ts
export type ModuleType = 'experience' | 'system';

export interface VRModuleManifest {
  id: string;
  name: string;
  version: string;
  type: ModuleType;
  description?: string;
  author?: string;
  dependencies?: string[];
  entry: string;
  enabledByDefault?: boolean;
}

export interface VRModuleContext {
  services: ServiceRegistry;
  events: EventBus;
  store: AppStore;
  scene: SceneController;
  ui: UIController;
  xr: XRController;
  assets: AssetController;
  logger: Logger;
}

export interface VRModule {
  manifest: VRModuleManifest;
  setup?(ctx: VRModuleContext): Promise<void> | void;
  mount?(ctx: VRModuleContext): Promise<void> | void;
  unmount?(ctx: VRModuleContext): Promise<void> | void;
  dispose?(ctx: VRModuleContext): Promise<void> | void;
}
```

---

## 8. Lifecycle do módulo

Todo módulo deve seguir estas etapas.

## 8.1 setup
Executa uma vez quando o módulo é carregado.

Usar para:

- registrar rotas/salas
- registrar serviços
- validar dependências
- preparar stores
- registrar eventos iniciais

Não usar para:

- criar objetos pesados de cena imediatamente, se não forem necessários

## 8.2 mount
Executa quando o módulo é ativado.

Usar para:

- montar UI
- entrar na sala
- adicionar objetos à cena
- ativar listeners
- ligar sistemas daquele módulo

## 8.3 unmount
Executa quando o módulo é desativado.

Usar para:

- remover UI
- parar loops
- remover objetos da cena
- desligar handlers

## 8.4 dispose
Executa quando o módulo for realmente descartado da memória.

Usar para:

- limpar caches
- destruir recursos pesados
- liberar texturas, geometries, materials

---

## 9. Fluxo de boot da aplicação

## 9.1 Sequência

1. iniciar app React/Next
2. iniciar runtime do core
3. criar store global
4. criar registries globais
5. iniciar serviços base
6. detectar suporte WebXR
7. carregar manifests de módulos
8. validar dependências
9. registrar módulos válidos
10. montar hub
11. permitir ativação sob demanda

## 9.2 Fluxo resumido

```txt
App Start
  -> CoreRuntime.create()
  -> ServiceRegistry.init()
  -> ModuleRegistry.loadManifests()
  -> ModuleRegistry.resolveDependencies()
  -> ModuleLoader.importEnabledModules()
  -> setup modules
  -> mount hub world
  -> user activates module
  -> mount selected module
```

---

## 10. Registry de módulos

É o coração do sistema plugável.

Responsável por:

- receber manifests
- evitar IDs duplicados
- validar dependências
- controlar estados
- saber o que está ativo
- bloquear módulos inválidos

### Estados possíveis

```ts
export type ModuleStatus =
  | 'discovered'
  | 'loaded'
  | 'setup'
  | 'mounted'
  | 'unmounted'
  | 'disposed'
  | 'error';
```

### Interface

```ts
export interface RegisteredModule {
  manifest: VRModuleManifest;
  status: ModuleStatus;
  instance?: VRModule;
  error?: unknown;
}
```

---

## 11. Loader de módulos

O loader importa módulos dinamicamente.

### Regras

- nunca importar tudo automaticamente sem necessidade
- usar lazy loading
- importar ao entrar no hub ou ao selecionar o módulo
- permitir preload manual se necessário

### Exemplo conceitual

```ts
const moduleImportMap: Record<string, () => Promise<{ default: VRModule }>> = {
  'hub-world': () => import('@vr/module-hub-world'),
  'training-room': () => import('@vr/module-training-room'),
  'inventory': () => import('@vr/module-inventory'),
};
```

---

## 12. Dependências entre módulos

Um módulo pode depender de outro.

Exemplo:

- `training-room` depende de `inventory`
- `voice-chat` depende de `network-core`

### Regra
Dependência deve ser declarada no manifest.

```ts
{
  id: 'training-room',
  name: 'Training Room',
  version: '1.0.0',
  type: 'experience',
  dependencies: ['inventory'],
  entry: 'training-room'
}
```

### Regras de segurança

- dependência ausente: módulo não sobe
- dependência com erro: módulo dependente não sobe
- detectar dependência circular

---

## 13. Event bus

Serve para comunicação desacoplada.

## Eventos permitidos

- mudança de sala
- módulo ativado
- módulo desativado
- item coletado
- usuário entrou em área
- XR entrou/saiu
- loading iniciado/finalizado

### Exemplo de contrato

```ts
export interface AppEvents {
  'module:mounted': { moduleId: string };
  'module:unmounted': { moduleId: string };
  'scene:change': { from?: string; to: string };
  'xr:entered': {};
  'xr:exited': {};
}
```

### Regra
Evento é bom para notificação.

Não use como substituto de toda lógica de negócio.

---

## 14. Serviço de cena

O core precisa de um controlador de cena.

Responsável por:

- trocar ambientes
- montar root scene
- anexar grupos de módulos
- resetar elementos temporários
- manter referências de câmera, luz base e player rig

### Estrutura recomendada

```txt
Scene Root
  Base Environment
  XR Rig
  Global Lights
  Shared UI Anchors
  Active Module Group
  Overlay Group
```

### Regra
Cada módulo deve montar seu conteúdo dentro de um grupo próprio.

Assim fica fácil remover tudo sem vazar objetos.

---

## 15. Serviço de XR

Responsável por:

- entrar e sair do modo XR
- detectar suporte
- expor controllers/hands
- expor headset pose
- gerenciar estados XR

### Estados úteis

- unsupported
- available
- entering
- active
- exiting
- error

### Responsabilidades do core XR

- abstrair WebXR bruto
- não deixar cada módulo falar direto com a API nativa se não precisar
- oferecer helpers estáveis

---

## 16. Input abstraction

Não amarre módulos diretamente ao controle específico.

Crie ações semânticas.

### Errado
- botão A do controle X faz tal coisa

### Certo
- action `grab`
- action `teleport`
- action `openMenu`
- action `confirm`

### Exemplo

```ts
export type InputAction =
  | 'grab'
  | 'release'
  | 'teleport'
  | 'openMenu'
  | 'interact';
```

Assim no futuro você troca:

- headset
- controle
- teclado/mouse fallback
- hand tracking

sem quebrar módulo.

---

## 17. UI system

A UI precisa existir em 3 camadas.

## 17.1 UI 2D shell
Para web normal:

- tela inicial
- loading
- erro
- configurações
- lista de módulos

## 17.2 UI world-space
Para VR:

- painéis no mundo
- botões 3D
- menus contextuais

## 17.3 UI overlay global
Para coisas persistentes:

- pause
- volume
- status XR
- debug

### Regra
Cada módulo só gerencia a própria UI.

O core gerencia:

- containers
- prioridades
- overlays globais

---

## 18. Estado global

Separar estado em 3 tipos.

## 18.1 Estado do core
Exemplo:

- módulo ativo
- suporte XR
- usuário em VR ou não
- loading global
- erro global

## 18.2 Estado do módulo
Cada módulo cuida do seu.

Exemplo:

- inventário atual
- progresso de puzzle
- inimigos ativos

## 18.3 Estado persistente
Salvo em localStorage, IndexedDB ou backend futuro.

Exemplo:

- preferências
- progresso
- configurações
- módulos favoritos

### Regra
Evite jogar tudo em um único store gigante.

---

## 19. Assets

Crie um AssetController.

Responsável por:

- preload
- cache
- descarte
- versionamento de paths
- impedir loads duplicados

### Regra
Módulo não deve fazer fetch de asset de forma arbitrária sem passar pelo controlador, exceto casos especiais.

---

## 20. Persistência

Na primeira versão, usar local.

### Ordem recomendada

1. localStorage para config simples
2. IndexedDB para dados maiores
3. backend apenas quando o produto exigir

### Persistir no início

- módulo favorito
- última sala usada
- preferências de locomoção
- volume
- sensibilidade

---

## 21. Sistema de permissões internas

Mesmo sendo projeto pessoal, vale prever níveis.

Exemplo:

- módulo pode registrar cena
- módulo pode registrar overlay global
- módulo pode registrar serviço
- módulo pode acessar storage persistente

Isso reduz risco de bagunça futura.

---

## 22. Tratamento de erro

Cada módulo precisa falhar isoladamente.

### Regra principal
Se um módulo quebrar, o hub continua funcionando.

### Medidas

- try/catch ao carregar módulo
- status `error`
- tela de erro por módulo
- logs estruturados
- fallback para hub

### Exemplo de comportamento

- usuário abre `training-room`
- import falha
- registrar erro
- mostrar mensagem
- continuar app vivo

---

## 23. Observabilidade e debug

Mesmo em projeto pequeno, crie isso cedo.

### Painel de debug mínimo

- módulos carregados
- status dos módulos
- tempo de load
- uso de memória estimado
- FPS
- estado XR
- eventos recentes

Isso economiza muito tempo.

---

## 24. Performance

VR é sensível.

### Regras obrigatórias

- lazy loading de módulos
- descarte de recursos ao sair da sala
- reduzir draw calls
- limitar shaders pesados
- evitar re-render React desnecessário
- separar lógica pesada do render loop
- evitar assets grandes por padrão

### Regra crítica
Módulo desmontado precisa realmente limpar:

- geometries
- materials
- textures
- listeners
- intervals
- animation loops

---

## 25. Segurança de arquitetura

### Nunca fazer

- módulo alterar store global arbitrariamente sem API
- módulo mexer direto em estruturas privadas do core
- módulo importar internals privados de outro módulo
- módulo assumir que outro módulo sempre está montado

### Sempre fazer

- usar contratos públicos
- declarar dependências
- validar manifests
- testar mount/unmount repetido

---

## 26. MVP realista

Não comece pelo sistema perfeito.

## Fase 1

Objetivo: validar arquitetura.

Entregar:

- hub central
- loader de módulos
- registry
- 1 módulo de experiência
- 1 módulo de sistema
- event bus
- scene controller

### Módulos sugeridos

1. `hub-world`
2. `training-room`
3. `inventory`

## Fase 2

Objetivo: validar escalabilidade.

Entregar:

- dependências entre módulos
- persistência local
- painel debug
- transitions entre salas
- preload opcional

## Fase 3

Objetivo: produto utilizável.

Entregar:

- manifesto externo por módulo
- instalação/desinstalação por config
- sistema de versões
- sistema de compatibilidade

---

## 27. Manifesto de módulo

Cada módulo deve exportar um manifesto legível.

```ts
import type { VRModuleManifest } from '@vr/module-sdk';

export const manifest: VRModuleManifest = {
  id: 'training-room',
  name: 'Training Room',
  version: '1.0.0',
  type: 'experience',
  description: 'Sala de treino com alvos e pontuação.',
  dependencies: ['inventory'],
  entry: 'training-room',
  enabledByDefault: false,
};
```

---

## 28. Exemplo de módulo funcional

```ts
import { manifest } from './manifest';
import type { VRModule } from '@vr/module-sdk';

const trainingRoomModule: VRModule = {
  manifest,

  setup(ctx) {
    ctx.logger.info('setup training-room');
    ctx.events.emit('module:mounted', { moduleId: manifest.id });
  },

  mount(ctx) {
    const group = ctx.scene.createModuleGroup(manifest.id);
    ctx.scene.addToActiveGroup(group);

    ctx.ui.mountPanel({
      id: 'training-room-panel',
      title: 'Training Room',
    });

    ctx.store.setState((state) => {
      state.activeExperience = manifest.id;
    });
  },

  unmount(ctx) {
    ctx.ui.unmountPanel('training-room-panel');
    ctx.scene.removeModuleGroup(manifest.id);
  },

  dispose(ctx) {
    ctx.logger.info('dispose training-room');
  },
};

export default trainingRoomModule;
```

---

## 29. Exemplo de runtime do core

```ts
export class CoreRuntime {
  constructor(
    private modules: ModuleRegistry,
    private services: ServiceRegistry,
    private ctx: VRModuleContext,
  ) {}

  async boot() {
    await this.services.initBase();
    await this.modules.discover();
    await this.modules.loadEnabled(this.ctx);
  }

  async activateModule(moduleId: string) {
    await this.modules.mount(moduleId, this.ctx);
  }

  async deactivateModule(moduleId: string) {
    await this.modules.unmount(moduleId, this.ctx);
  }
}
```

---

## 30. Exemplo de ModuleRegistry

```ts
export class ModuleRegistry {
  private modules = new Map<string, RegisteredModule>();

  register(manifest: VRModuleManifest) {
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module already registered: ${manifest.id}`);
    }

    this.modules.set(manifest.id, {
      manifest,
      status: 'discovered',
    });
  }

  async instantiate(
    moduleId: string,
    importer: () => Promise<{ default: VRModule }>,
  ) {
    const current = this.modules.get(moduleId);
    if (!current) throw new Error(`Module not found: ${moduleId}`);

    const imported = await importer();
    current.instance = imported.default;
    current.status = 'loaded';
  }

  async setup(moduleId: string, ctx: VRModuleContext) {
    const current = this.modules.get(moduleId);
    if (!current?.instance) throw new Error(`Module not loaded: ${moduleId}`);

    await current.instance.setup?.(ctx);
    current.status = 'setup';
  }

  async mount(moduleId: string, ctx: VRModuleContext) {
    const current = this.modules.get(moduleId);
    if (!current?.instance) throw new Error(`Module not loaded: ${moduleId}`);

    await current.instance.mount?.(ctx);
    current.status = 'mounted';
  }

  async unmount(moduleId: string, ctx: VRModuleContext) {
    const current = this.modules.get(moduleId);
    if (!current?.instance) return;

    await current.instance.unmount?.(ctx);
    current.status = 'unmounted';
  }
}
```

---

## 31. Configuração de módulos

Você pode controlar ativação por arquivo.

```ts
export const moduleConfig = {
  enabled: ['hub-world', 'inventory'],
  available: ['hub-world', 'inventory', 'training-room'],
};
```

Mais tarde pode evoluir para:

- painel admin
- manifest remoto
- marketplace interno

---

## 32. Fluxo de navegação recomendado

### Estado inicial
Usuário abre o projeto no navegador.

### Fluxo

1. shell carrega
2. core sobe
3. hub aparece
4. usuário escolhe módulo
5. sistema valida dependências
6. módulo carrega
7. transição visual
8. módulo monta cena e UI
9. ao sair, unmount
10. volta para hub

---

## 33. Contrato dos serviços do core

O módulo não deveria acessar coisas soltas.

Crie serviços claros.

### Serviços mínimos

- `sceneService`
- `xrService`
- `inputService`
- `uiService`
- `assetService`
- `storageService`
- `loggerService`
- `moduleService`

---

## 34. Testes mínimos obrigatórios

## 34.1 Core

- boot sem módulos
- boot com módulo inválido
- dependência faltando
- dependência circular
- mount/unmount repetido

## 34.2 Módulos

- setup funciona
- mount cria recursos
- unmount limpa recursos
- dispose limpa memória
- falha isolada não derruba app

## 34.3 XR

- fallback sem headset
- entrar e sair do modo VR
- reconectar controllers

---

## 35. Roadmap de implementação

## Etapa 1 — foundation

Criar:

- monorepo
- package core
- package module-sdk
- app hub
- types compartilhados

## Etapa 2 — runtime

Criar:

- CoreRuntime
- ModuleRegistry
- ServiceRegistry
- EventBus
- AppStore

## Etapa 3 — XR e cena

Criar:

- XRController
- SceneController
- Input abstraction

## Etapa 4 — primeiro módulo

Criar:

- hub-world
- training-room

## Etapa 5 — módulo transversal

Criar:

- inventory

## Etapa 6 — robustez

Criar:

- logs
- painel debug
- persistência local
- tratamento de erro por módulo

---

## 36. O que não fazer agora

Evite no início:

- multiplayer
- marketplace real de módulos
- sincronização remota
- editor visual
- sistema de permissões complexo
- microfrontend exagerado

Tudo isso aumenta muito o custo antes da base provar valor.

---

## 37. Arquitetura mínima recomendada para começar

Se quiser começar certo sem exagero, faça exatamente isso:

### Core

- app shell
- runtime
- registry
- loader
- event bus
- scene controller
- xr controller
- ui controller

### Módulos

- `hub-world`
- `training-room`
- `inventory`

### Resultado

Você já terá:

- projeto VR único
- sala principal
- sistema plugável real
- base para expandir

---

## 38. Conclusão

A arquitetura correta para a sua ideia é:

- um **core pequeno e estável**
- um **SDK rígido de módulos**
- módulos com **lifecycle previsível**
- comunicação por **eventos e serviços públicos**
- cena principal em forma de **hub**

O ponto central não é VR.

O ponto central é **desacoplamento com controle**.

Se fizer isso direito, você consegue transformar cada nova ideia VR em um módulo, sem recriar o projeto inteiro.

---

## 39. Próximo passo recomendado

Implementar um MVP com:

- 1 hub
- 1 experiência
- 1 sistema transversal
- 1 loader real
- 1 contract SDK

Depois disso, ajustar a arquitetura com base no uso real.

