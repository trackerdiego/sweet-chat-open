import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, MessageSquare, Wrench, FileText } from "lucide-react";

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
  users: Array<{
    user_id: string;
    display_name: string;
    email: string;
    primary_niche: string;
    is_premium: boolean;
    script_generations: number;
    tool_generations: number;
    transcriptions: number;
    chat_messages: number;
    last_script_date: string | null;
  }>;
  recentLogs: Array<{
    id: string;
    user_id: string;
    feature: string;
    created_at: string;
  }>;
}

export default function Admin() {
  const { profile } = useUserProfile();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-dashboard`,
        { headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" } }
      );
      if (!res.ok) { setError("Acesso negado"); setLoading(false); return; }
      const json = await res.json();
      setData(json);
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
                <TableHead>Plano</TableHead>
                <TableHead className="text-center">Scripts</TableHead>
                <TableHead className="text-center">Tools</TableHead>
                <TableHead className="text-center">Chat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                  <TableCell>{u.primary_niche}</TableCell>
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
    </div>
  );
}
