import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Users, Crown, MessageSquare, Wrench, FileText, CheckCircle2, Clock, Brain, Target } from "lucide-react";

interface UserData {
  user_id: string;
  display_name: string;
  email: string;
  primary_niche: string;
  secondary_niches: string[];
  content_style: string;
  audience_size: string;
  onboarding_completed: boolean;
  description_status: string;
  profile_created_at: string;
  auth_created_at: string;
  is_premium: boolean;
  script_generations: number;
  tool_generations: number;
  transcriptions: number;
  chat_messages: number;
  last_script_date: string | null;
  last_tool_date: string | null;
  last_chat_date: string | null;
  last_transcription_date: string | null;
  has_audience_profile: boolean;
  audience_description: string | null;
  audience_generated_at: string | null;
  has_strategy: boolean;
  strategy_generated_at: string | null;
}

interface DashboardData {
  metrics: {
    totalUsers: number;
    premiumUsers: number;
    freeUsers: number;
    totalScripts: number;
    totalTools: number;
    totalTranscriptions: number;
    totalChat: number;
  };
  users: UserData[];
  recentLogs: Array<{
    id: string;
    user_id: string;
    feature: string;
    created_at: string;
  }>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

const contentStyleMap: Record<string, string> = {
  casual: "Casual",
  professional: "Profissional",
  educational: "Educativo",
  entertaining: "Entretenimento",
};

const audienceSizeMap: Record<string, string> = {
  starting: "Começando (0-1k)",
  growing: "Crescendo (1k-10k)",
  established: "Estabelecido (10k-100k)",
  large: "Grande (100k+)",
};

export default function Admin() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Acesso negado");
        setLoading(false);
        return;
      }

      const { data: dashboardData, error: functionError } = await supabase.functions.invoke("admin-dashboard", {
        method: "GET",
      });

      if (functionError || !dashboardData) {
        setError("Acesso negado");
        setLoading(false);
        return;
      }

      setData(dashboardData as DashboardData);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (error) return <Navigate to="/" replace />;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Carregando painel...</div></div>;
  if (!data) return <Navigate to="/" replace />;

  const { metrics, users, recentLogs } = data;
  const userMap: Record<string, string> = {};
  users.forEach(u => { userMap[u.user_id] = u.display_name || u.email; });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">Painel Administrativo</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">{metrics.freeUsers} free · {metrics.premiumUsers} premium</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scripts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.totalScripts}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ferramentas IA</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.totalTools}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chat IA</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.totalChat}</div></CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader><CardTitle className="text-lg">Usuários</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Onboarding</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-center">Scripts</TableHead>
                <TableHead className="text-center">Tools</TableHead>
                <TableHead className="text-center">Chat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id} className="cursor-pointer hover:bg-muted/80" onClick={() => setSelectedUser(u)}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                  <TableCell>{u.primary_niche}</TableCell>
                  <TableCell>
                    {u.description_status === 'ok' ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Descrição OK</Badge>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.is_premium ? (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Crown className="h-3 w-3 mr-1" /> Premium</Badge>
                    ) : (<Badge variant="secondary">Free</Badge>)}
                  </TableCell>
                  <TableCell className="text-center">{u.script_generations}</TableCell>
                  <TableCell className="text-center">{u.tool_generations}</TableCell>
                  <TableCell className="text-center">{u.chat_messages}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Logs Recentes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Funcionalidade</TableHead>
                <TableHead>Data/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{userMap[log.user_id] || log.user_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline">{log.feature}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-xl">{selectedUser?.display_name}</SheetTitle>
            <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
          </SheetHeader>

          {selectedUser && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex gap-2 flex-wrap">
                {selectedUser.is_premium ? (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Crown className="h-3 w-3 mr-1" />Premium</Badge>
                ) : (<Badge variant="secondary">Free</Badge>)}
                {selectedUser.description_status === 'ok' ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Descrição OK</Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                )}
              </div>

              <Separator />

              {/* Profile Info */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Perfil</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Nicho:</span> <span className="font-medium">{selectedUser.primary_niche}</span></div>
                  <div><span className="text-muted-foreground">Estilo:</span> <span className="font-medium">{contentStyleMap[selectedUser.content_style] || selectedUser.content_style}</span></div>
                  <div><span className="text-muted-foreground">Audiência:</span> <span className="font-medium">{audienceSizeMap[selectedUser.audience_size] || selectedUser.audience_size}</span></div>
                  <div><span className="text-muted-foreground">Cadastro:</span> <span className="font-medium">{formatDate(selectedUser.auth_created_at)}</span></div>
                </div>
                {selectedUser.secondary_niches?.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Nichos secundários:</span>{" "}
                    <span className="font-medium">{selectedUser.secondary_niches.join(", ")}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* AI Content Status */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Conteúdo IA</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    <span>Estudo de Público:</span>
                    {selectedUser.has_audience_profile ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Gerado em {formatDate(selectedUser.audience_generated_at)}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Não gerado</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span>Matriz de Estratégias:</span>
                    {selectedUser.has_strategy ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Gerada em {formatDate(selectedUser.strategy_generated_at)}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Não gerada</Badge>
                    )}
                  </div>
                </div>
                {selectedUser.audience_description && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                    <p className="font-medium mb-1">Descrição do público:</p>
                    {selectedUser.audience_description.slice(0, 300)}{selectedUser.audience_description.length > 300 && "..."}
                  </div>
                )}
              </div>

              <Separator />

              {/* Usage Stats */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Uso da Plataforma</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-2xl font-bold">{selectedUser.script_generations}</div>
                    <div className="text-xs text-muted-foreground">Scripts gerados</div>
                    <div className="text-xs text-muted-foreground">Último: {formatDate(selectedUser.last_script_date)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-2xl font-bold">{selectedUser.tool_generations}</div>
                    <div className="text-xs text-muted-foreground">Ferramentas IA</div>
                    <div className="text-xs text-muted-foreground">Último: {formatDate(selectedUser.last_tool_date)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-2xl font-bold">{selectedUser.chat_messages}</div>
                    <div className="text-xs text-muted-foreground">Mensagens Chat</div>
                    <div className="text-xs text-muted-foreground">Último: {formatDate(selectedUser.last_chat_date)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-2xl font-bold">{selectedUser.transcriptions}</div>
                    <div className="text-xs text-muted-foreground">Transcrições</div>
                    <div className="text-xs text-muted-foreground">Último: {formatDate(selectedUser.last_transcription_date)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
