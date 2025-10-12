# Achadinhos do Dia

## Visão Geral
Site de catálogo de produtos com links de afiliado para Shopee, Mercado Livre e Amazon. O design é colorido e divertido, focado em ofertas garimpadas.

## Mudanças Recentes (11 Out 2025)
- **Simplificação do sistema de links**: Removido campo "link" do produto, mantendo apenas "affiliateLink" como campo obrigatório
- Painel admin atualizado com formulário simplificado contendo apenas "Link de Afiliado"
- Todos os botões "Ver Oferta" redirecionam diretamente para o link de afiliado cadastrado
- **Funcionalidade "Ver mais"**: Adicionado botão para expandir/colapsar descrição dos produtos (aparece quando descrição > 80 caracteres nos produtos e > 100 caracteres no produto em destaque)
- **Sistema de imagens simplificado**: Removido carrossel de imagens - agora cada produto usa apenas 1 foto principal (campo `imagem`). Imagens são exibidas com `object-contain` para mostrar o produto completo sem cortes

## Decisões de Design

### Emojis
**Decisão Final**: Os emojis foram mantidos conforme especificação explícita do usuário:
- Categorias: "Beleza 💄", "Tech ⚙️", "Casa 🏠", "Moda 👗", "Pets 🐾" (texto exato fornecido)
- Rodapé: "Achadinhos garimpados com 💖" (texto exato fornecido)
- Header: Sparkles decorativos

Esta é uma decisão consciente que prioriza os requisitos explícitos do usuário sobre as universal design guidelines genéricas. Os emojis fazem parte da identidade visual "divertida" e "criativa" solicitada.

### Cores
- **Rosa**: #FF66B3 (330 100% 70%) - Primary/Pink
- **Laranja**: #FFA64D (28 100% 65%) - Secondary/Orange  
- **Azul**: #5AC8FA (200 100% 65%) - Blue
- **Fundo**: Bege suave (30 30% 98%)

### Tipografia
- Fonte principal: Poppins (Google Fonts)
- Fallback: Quicksand

## Estrutura do Projeto

### Frontend (`client/`)
- `pages/home.tsx` - Página principal com todos os componentes
- Design system configurado em `index.css` e `tailwind.config.ts`

### Backend (`server/`)
- `storage.ts` - Armazenamento em memória com 12 produtos de exemplo
- `routes.ts` - API endpoints:
  - GET `/api/products` - Lista todos os produtos
  - GET `/api/products/featured` - Produto em destaque
  - GET `/api/products/category/:categoria` - Produtos por categoria
  - GET `/api/products/:id` - Produto específico
  - POST `/api/admin/products` - Criar produto (admin)
  - PUT `/api/admin/products/:id` - Atualizar produto (admin)
  - DELETE `/api/admin/products/:id` - Deletar produto (admin)

### Shared (`shared/`)
- `schema.ts` - Schema de produtos com tipos TypeScript
  - Produto: id, categoria, nome, descricao, preco, imagem, **affiliateLink** (obrigatório), destaque
  - User: id, name, email, password, isAdmin, createdAt

## Funcionalidades
1. ✅ Cabeçalho com logo e slogan
2. ✅ Filtro de categorias (Todas, Beleza, Tech, Casa, Moda, Pets)
3. ✅ Seção "Achadinho do Dia" em destaque
4. ✅ Grade responsiva de produtos (1-4 colunas)
5. ✅ Cards com imagem, nome, preço e botão "Ver Oferta"
6. ✅ Redirecionamento para links de afiliado
7. ✅ Loading states e animações
8. ✅ Rodapé com mensagem de apoio

## Produtos de Exemplo
- 12 produtos em 5 categorias diferentes
- 1 produto em destaque (Fone Bluetooth TWS Pro)
- Imagens do Unsplash
- Links para Shopee, Mercado Livre e Amazon

## Tecnologias
- React + TypeScript
- Tailwind CSS + Shadcn/UI
- React Query
- Express.js
- In-memory storage
