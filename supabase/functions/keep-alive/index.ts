// Keep-alive endpoint — pinged by cron no VPS pra evitar pausa do Supabase Cloud.
// Resposta mínima, sem DB, sem dependências externas.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ ok: true, ts: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
});
