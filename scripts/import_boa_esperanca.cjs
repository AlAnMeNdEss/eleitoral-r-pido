const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 1. Setup client
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

// 2. Read Excel
const excelPath = 'C:/Users/alanm/Desktop/sistemas pesquisas/2302602_CAMOCIM BOA ESPERANÇA.xlsx';

async function main() {
  console.log('Autenticando...');
  const email = 'admin.import@pesquisa.com';
  const password = 'PesquisaPassword2026!';
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Erro de autenticação:', authErr.message);
    return;
  }
  console.log('Autenticado com sucesso.');

  console.log('Lendo planilha Excel de Camocim / Boa Esperança...');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(sheet);
  console.log(`Planilha lida: ${allRows.length} linhas.`);

  // Priorizar Boa Esperança
  const rows = allRows.filter(r => {
    const loc = String(r.DSC_LOCALIDADE || '').toUpperCase();
    return loc.includes('BOA ESPERAN');
  });

  console.log(`\nImportando ${rows.length} endereços do Bairro BOA ESPERANÇA...`);

  let criados = 0;
  let atualizados = 0;
  let erros = 0;

  // Processar em lotes usando Promise.all em blocos de 20
  const CHUNK_SIZE = 25;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(
      chunk.map(async (r) => {
        const bNome = 'Boa Esperança';
        const tipo = String(r.NOM_TIPO_SEGLOGR || '').trim();
        const titulo = String(r.NOM_TITULO_SEGLOGR || '').trim();
        const seg = String(r.NOM_SEGLOGR || '').trim();
        let ruaNome = [tipo, titulo, seg].filter(Boolean).join(' ');
        if (!ruaNome) ruaNome = 'Sem Denominação';

        let numero = String(r.NUM_ENDERECO !== undefined && r.NUM_ENDERECO !== null ? r.NUM_ENDERECO : 'S/N').trim();
        if (numero === '0' || numero === '') numero = 'S/N';

        const compParts = [
          r.DSC_MODIFICADOR,
          r.NOM_COMP_ELEM1, r.VAL_COMP_ELEM1,
          r.NOM_COMP_ELEM2, r.VAL_COMP_ELEM2,
        ].filter(Boolean).map(String).join(' ').trim();

        let latitude = null;
        let longitude = null;
        if (r.LATITUDE && r.LONGITUDE) {
          const latVal = Number(r.LATITUDE);
          const lngVal = Number(r.LONGITUDE);
          if (!isNaN(latVal) && !isNaN(lngVal)) {
            latitude = latVal > 0 || latVal < -100 ? latVal / 1000000 : latVal;
            longitude = lngVal > 0 || lngVal < -100 ? lngVal / 1000000 : lngVal;
          }
        }

        try {
          const { data, error } = await supabase.rpc('upsert_imovel', {
            p_bairro: bNome,
            p_localidade: '',
            p_rua: ruaNome,
            p_numero: numero,
            p_complemento: compParts || '',
            p_resultado: null,
            p_observacao: null,
            p_data: null,
            p_equipe: null,
            p_latitude: latitude,
            p_longitude: longitude,
            p_nome_morador: null,
            p_voto_estadual: null,
            p_voto_federal: null,
            p_voto_senador: null,
            p_voto_governador: null,
            p_voto_presidente: null,
            p_situacao: null,
          });

          if (error) {
            erros++;
          } else {
            if (data?.criado) criados++;
            else atualizados++;
          }
        } catch {
          erros++;
        }
      })
    );

    const processed = Math.min(i + CHUNK_SIZE, rows.length);
    process.stdout.write(`\rProgresso: ${processed} / ${rows.length} (${criados} novos, ${atualizados} atualizados)...`);
  }

  console.log(`\n\n🎉 Importação do Bairro Boa Esperança concluída com sucesso!`);
  console.log(`- Imóveis novos cadastrados: ${criados}`);
  console.log(`- Imóveis atualizados: ${atualizados}`);
  console.log(`- Erros: ${erros}`);
}

main().catch(console.error);
