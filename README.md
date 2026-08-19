# Eleitoral Rápido

Crie um MVP funcional de um sistema web para organizar pesquisas eleitorais por bairro, localidade, rua e imóvel, usando o Supabase já conectado ao projeto.

O sistema deve ser simples, intuitivo e mobile-first, funcionando bem no celular e no computador. Não crie dezenas de funções.

FUNÇÕES PRINCIPAIS

1. Dashboard
Mostrar apenas:

Total de imóveis

Pesquisados

Pendentes

Indecisos

Não encontrados

Atalhos:

Importar planilha

Novo imóvel

Pesquisar endereço

Mapa

2. Importação de planilhas
Permitir importar Excel (.xlsx) e CSV.

A planilha padrão terá:

Bairro

Localidade

Rua

Número

Complemento

Resultado

Observação

Data da pesquisa

Equipe

Antes de importar, mostrar uma prévia e informar:

novos imóveis

imóveis já existentes

registros que serão atualizados

erros

Não criar duplicidades. Identificar o imóvel por bairro + localidade + rua + número + complemento.

3. Cadastro manual
Permitir cadastrar rapidamente:

Bairro

Localidade

Rua

Número

Complemento

Resultado

Observação

Data

Equipe

Resultados:

Apoia

Não apoia

Indeciso

Não respondeu

Não encontrado

4. Endereços
Organizar:

Bairro → Localidade → Rua → Imóveis

Deve ser possível cadastrar um número novo mesmo que ele não exista na base antiga.

5. Mapa
Mostrar os imóveis cadastrados em um mapa.

Ao cadastrar um endereço, tentar obter automaticamente latitude e longitude através de uma API de geocodificação.

Utilizar uma solução adequada para o Brasil, preferencialmente baseada em dados abertos quando possível.

Se o endereço não for encontrado, permitir marcar a localização manualmente no mapa.

Guardar latitude/longitude no Supabase usando PostGIS quando apropriado.

Não colocar chaves secretas de APIs no frontend. Usar Edge Functions/variáveis seguras quando necessário.

6. Pesquisa
Criar uma busca rápida por:

Bairro

Rua

Número

Ao encontrar o imóvel, abrir seu cadastro e permitir editar a pesquisa.

BANCO DE DADOS

Crie toda a estrutura necessária no Supabase, incluindo:

bairros

localidades

ruas

imóveis

pesquisas

equipes

importações

erros de importação

Criar relacionamentos, índices, constraints, migrations e RLS corretamente.

Não criar outro banco e não usar dados mockados.

DESIGN

Interface:

limpa

moderna

muito simples

mobile-first

poucos menus

botões grandes

navegação inferior no celular

Não criar gráficos ou funcionalidades desnecessárias.

IMPORTANTE

O fluxo principal precisa funcionar de ponta a ponta:

Receber planilha → importar → identificar novos/existentes → evitar duplicidades → cadastrar/atualizar → localizar no mapa → pesquisar e editar endereço.

Antes de finalizar, teste o CRUD, importação XLSX/CSV, duplicidades, banco, RLS, mapa, geolocalização e versão mobile.

Corrija os erros encontrados. Quero um MVP realmente funcional, não apenas uma interface visual.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c4000695-49f0-4e9c-8eb9-63273b3f1f2a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
