# 📱 Mobile Front-End Application

Este é o repositório front-end mobile do projeto, desenvolvido com **React Native** e **TypeScript**. O aplicativo foi projetado com foco em alta coesão, baixo acoplamento e na aplicação de padrões de **Clean Code**, garantindo uma base de código escalável e de fácil manutenção.

## 🚀 Principais Funcionalidades

- **Autenticação e Controle de Acesso:** Fluxos isolados e seguros para usuários comuns e administradores (`Auth` e `AuthAdmin`), consumindo JWT da API.
- **Operações CRUD Completas:** Comunicação bidirecional e robusta com a API backend para listagem, criação, edição e exclusão de entidades.
- **Upload e Manipulação de Imagens:** Integração nativa com o backend (Multer) para envio seguro de imagens, incluindo tratamentos de extensão e prevenção de colisão de nomes.
- **Separação de Responsabilidades:** Arquitetura orientada a componentes, isolando a camada de UI, a camada de Navegação e a camada de Regras de Negócio (através de Custom Hooks).

## 🛠️ Tecnologias e Arquitetura

- **React Native & Expo:** Framework principal para desenvolvimento cross-platform.
- **TypeScript:** Tipagem estática em toda a aplicação, garantindo previsibilidade no consumo dos *models* e respostas da API.
- **Arquitetura Desacoplada:** O código foi refatorado ativamente para separar contextos (ex: navegação isolada e painel admin independente).
- **Gestão de Estado:** Gerenciamento eficiente da interface em sincronia com o banco de dados relacional e requisitos RESTful.

## 📚 Documentação e Engenharia de Software

O desenvolvimento deste aplicativo foi amplamente guiado por rigorosas práticas de Engenharia de Software. Os seguintes artefatos podem ser encontrados nas pastas de documentação e evidências (`docs.md/` e `evidencias/`):

- **Diagramas UML:** Casos de Uso, Diagramas de Atividades, Diagramas de Sequência e DER (Diagrama Entidade-Relacionamento).
- **Requisitos:** Mapeamento completo de RFs e RNFs alinhados à integração com Sequelize/Prisma.
- **Evolução do Produto:** Contextualização do projeto através do framework Cynefin e resolução de problemas estruturados.
- **UX/Persona:** Design e fluxos guiados pelo perfil de usuário alvo do projeto (Persona: João Hernandez).
- **Pipeline CI/CD:** Automação de testes e processos de integração (via Husky e linting).

## 💻 Como Executar o Projeto

### Pré-requisitos
Certifique-se de ter o [Node.js](https://nodejs.org/) e o [Expo CLI](https://docs.expo.dev/) instalados na sua máquina, além do backend estar rodando localmente para as chamadas de API.

### Passos para instalação

1. Clone o repositório:
   ```bash
   git clone <url-do-repositorio>
   ```
2. Acesse o diretório do projeto:
   ```bash
   cd mobile-front-develop
   ```
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto contendo a URL da API (ex: `EXPO_PUBLIC_API_URL=http://localhost:3000/api`).

5. Inicie a aplicação:
   ```bash
   npx expo start
   ```

---
*Este projeto foi desenvolvido aplicando os mais altos padrões acadêmicos e de mercado, focado em performance, clean code e segurança.*
