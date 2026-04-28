import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle2, DollarSign, TrendingDown, Activity, Users, Eye, RotateCw, Clock } from "lucide-react";
import { toast } from "sonner";

interface HealthData {
  generated_at: string;
  mrr: {
    active_payers: number;
    trialing: number;
    churned_total: number;
    churn_30d: number;
    churn_rate_pct: number;
    mrr_brl: number;
    new_paying_today: number;
    trial_ending_soon: number;
    trial_ending_list: Array<{ user_id: string; trial_ends_at: string; plan: string }>;
  };
  webhooks: {
    recent: Array<{ id: string; event_id: string; event_type: string; user_id: string | null; received_at: string; processed_at: string | null; processing_error: string | null; payload: unknown }>;
    failed_count: number;
    orphan_count: number;
    orphans: Array<{ id: string; event_id: string; event_type: string; received_at: string; processing_error: string | null; payload: unknown }>;
  };
  ai_jobs: {
    total_24h: number;
    completed_24h: number;
    failed_24h: number;
    success_rate_pct: number;
    avg_latency_ms: number;
    by_type: Record<string, { total: number; failed: number }>;
    recent_failures: Array<{ id: string; job_type: string; error_message: string | null; created_at: string; user_id: string }>;
  };
  onboarding: {
    total_7d: number;
    completed_7d: number;
    failed_7d: number;
    running: number;
    completion_rate_pct: number;
    drop_off_by_stage: Record<string, number>;
  };
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function LaunchHealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [payloadView, setPayloadView] = useState<unknown | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data: res, error } = await supabase.functions.invoke("admin-launch-health", { method: "GET" });
    if (error || !res) {
      if (!silent) toast.error("Falha ao carregar Launch Health");
    } else {
      setData(res as HealthData);
      setLastRefresh(new Date());
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReprocess = async (event_id: string) => {
    setReprocessingId(event_id);
    const { data: res, error } = await supabase.functions.invoke("admin-reprocess-asaas-event", {
      method: "POST",
      body: { event_id },
    });
    setReprocessingId(null);
    if (error) {
      toast.error("Erro ao reprocessar: " + error.message);
      return;
    }
    const body: any = res;
    if (body?.upstream_status === 200) {
      toast.success(`Reprocessado · userId: ${body.upstream_body?.userId?.slice(0, 8) || "?"}`);
      fetchData();
    } else {
      toast.error(`Falha (${body?.upstream_status}): ${JSON.stringify(body?.upstream_body)}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando Launch Health...</div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-destructive">Não foi possível carregar os dados.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Launch Health
          </h2>
          <p className="text-xs text-muted-foreground">
            Auto-refresh 30s · Atualizado às {lastRefresh ? fmtTime(lastRefresh.toISOString()) : "—"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchData()} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar agora
        </Button>
      </div>

      {/* KPIs MRR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {data.mrr.mrr_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{data.mrr.active_payers} pagantes ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Novos hoje</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{data.mrr.new_paying_today}</div>
            <p className="text-xs text-muted-foreground">{data.mrr.trialing} em trial</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Churn 30d</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.mrr.churn_rate_pct}%</div>
            <p className="text-xs text-muted-foreground">{data.mrr.churn_30d} cancelamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Trials acabando</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.mrr.trial_ending_soon}</div>
            <p className="text-xs text-muted-foreground">próximos 3 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Jobs + Onboarding KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">AI Jobs (24h)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.ai_jobs.success_rate_pct}%</div>
            <p className="text-xs text-muted-foreground">
              {data.ai_jobs.completed_24h}/{data.ai_jobs.total_24h} OK · {data.ai_jobs.failed_24h} falhas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Latência média IA</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.ai_jobs.avg_latency_ms / 1000).toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">por job concluído</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Onboarding (7d)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.onboarding.completion_rate_pct}%</div>
            <p className="text-xs text-muted-foreground">
              {data.onboarding.completed_7d}/{data.onboarding.total_7d} concluídos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Webhooks</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {data.webhooks.failed_count + data.webhooks.orphan_count === 0 ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-400" /> OK</>
              ) : (
                <><AlertTriangle className="h-5 w-5 text-amber-400" /> {data.webhooks.failed_count + data.webhooks.orphan_count}</>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.webhooks.failed_count} falhas · {data.webhooks.orphan_count} órfãos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Webhooks recentes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Webhooks Asaas — Últimos 50</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.webhooks.recent.map((e) => {
                const isFailed = !!e.processing_error;
                const isOrphan = !e.user_id;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(e.received_at)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{e.event_type}</Badge></TableCell>
                    <TableCell>
                      {isFailed ? (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">Falha</Badge>
                      ) : isOrphan ? (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Órfão</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{e.user_id?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={e.processing_error || ""}>
                      {e.processing_error || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPayloadView(e.payload)} title="Ver payload">
                          <Eye className="h-3 w-3" />
                        </Button>
                        {(isFailed || isOrphan) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={reprocessingId === e.event_id}
                            onClick={() => handleReprocess(e.event_id)}
                            title="Reprocessar"
                          >
                            <RotateCw className={`h-3 w-3 ${reprocessingId === e.event_id ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Falhas recentes de IA */}
      {data.ai_jobs.recent_failures.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Falhas de AI Jobs (7d)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ai_jobs.recent_failures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(f.created_at)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{f.job_type}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{f.user_id?.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[300px] truncate" title={f.error_message || ""}>
                      {f.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Trials acabando */}
      {data.mrr.trial_ending_list.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Trials acabando em 3 dias</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Termina em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mrr.trial_ending_list.map((t) => (
                  <TableRow key={t.user_id}>
                    <TableCell className="text-xs font-mono">{t.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{t.plan || "—"}</Badge></TableCell>
                    <TableCell className="text-xs">{fmtDateTime(t.trial_ends_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payload viewer */}
      <Dialog open={!!payloadView} onOpenChange={(o) => !o && setPayloadView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Payload do evento</DialogTitle></DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[60vh]">
            {JSON.stringify(payloadView, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
