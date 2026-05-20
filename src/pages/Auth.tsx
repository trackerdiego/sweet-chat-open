import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft, Gift } from 'lucide-react';
import logo from '@/assets/vyrallab-logo-light.png';
import { InAppBrowserBanner } from '@/components/InAppBrowserBanner';

const REF_STORAGE_KEY = 'pending_ref';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [refOwnerName, setRefOwnerName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('ref');
    const stored = localStorage.getItem(REF_STORAGE_KEY);
    const code = fromUrl || stored;
    if (!code) return;
    if (fromUrl) {
      localStorage.setItem(REF_STORAGE_KEY, fromUrl);
      setIsLogin(false);
    }
    setRefCode(code);
    (async () => {
      const { data: codeRow } = await (supabase.from as any)('referral_codes')
        .select('user_id').eq('code', code).maybeSingle();
      if (!codeRow) return;
      const { data: profile } = await (supabase.from as any)('user_profiles')
        .select('display_name').eq('user_id', codeRow.user_id).maybeSingle();
      if (profile?.display_name) setRefOwnerName(profile.display_name);
    })();
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Digite seu email'); return; }
    setLoading(true);
    try {
      // Checa via edge function (consulta auth.users com service role)
      let exists = true; // fallback seguro: assume que existe
      let usedFallback = false;
      try {
        const { data, error } = await supabase.functions.invoke('check-email-exists', {
          body: { email: email.trim().toLowerCase() },
        });
        if (error) {
          usedFallback = true;
        } else {
          exists = !!data?.exists;
          if (data?.fallback) usedFallback = true;
        }
      } catch {
        usedFallback = true;
      }

      if (!exists && !usedFallback) {
        toast.error('Não encontramos uma conta com este email. Verifique se digitou corretamente ou crie uma nova conta.', {
          duration: 6000,
          action: {
            label: 'Criar conta',
            onClick: () => {
              setIsForgotPassword(false);
              setIsLogin(false);
            },
          },
        });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(
        usedFallback
          ? 'Se este email estiver cadastrado, você receberá o link em até 1 minuto. Verifique também o spam.'
          : 'Email de recuperação enviado! Verifique sua caixa de entrada (e o spam).'
      );
      setIsForgotPassword(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar email');
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (refCode && data.session) {
          try {
            await supabase.functions.invoke('register-referral', { body: { code: refCode } });
          } catch (e) {
            console.warn('register-referral failed', e);
          }
          localStorage.removeItem(REF_STORAGE_KEY);
        }

        if (data.session) {
          toast.success('Conta criada com sucesso! 🎉');
        } else {
          setShowConfirmation(true);
        }
        return;
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };



  if (showConfirmation) {
    return (
      <Shell>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm mt-10">
          <div className="glass-card p-8 text-center space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
              <Mail size={32} className="text-primary" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Confirme seu <span className="text-primary">email</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>.
            </p>
            <div className="bg-secondary/60 border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">💡 <strong>Não encontrou?</strong> Verifique sua pasta de spam.</p>
            </div>
            <Button onClick={() => { setShowConfirmation(false); setIsLogin(true); setPassword(''); }} className="w-full gold-gradient text-primary-foreground">
              <ArrowLeft size={16} /> Já confirmei, fazer login
            </Button>
          </div>
        </motion.div>
      </Shell>
    );
  }

  if (isForgotPassword) {
    return (
      <Shell>
        <div className="text-center mt-6 mb-6">
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Recuperar <span className="text-primary">senha</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2">Digite seu email para receber o link</p>
        </div>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm">
          <form onSubmit={handleForgotPassword} className="glass-card p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="off" required />
            </div>
            <Button type="submit" className="w-full gold-gradient text-primary-foreground" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              Enviar link de recuperação
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            <button onClick={() => setIsForgotPassword(false)} className="text-primary font-medium hover:underline">Voltar ao login</button>
          </p>
        </motion.div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center mt-6 mb-6">
        <h1 className="font-serif text-3xl font-bold text-foreground">
          {isLogin ? <>Boas-vindas de <span className="text-primary">volta</span></> : <>Crie sua <span className="text-primary">conta</span></>}
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          {isLogin ? 'Entre para acessar seu painel' : 'Comece sua jornada de 30 dias'}
        </p>
      </div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm">
        {refCode && !isLogin && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary px-3 py-1 text-xs font-medium w-full justify-center">
            <Gift size={14} />
            <span>
              {refOwnerName ? <>Convidado por <strong>{refOwnerName}</strong> 🎁</> : 'Convidado para o Vyral Lab 🎁'}
            </span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Seu nome</Label>
              <Input id="displayName" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como podemos te chamar?" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="off" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              {isLogin && (
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-primary hover:underline">
                  Esqueci minha senha
                </button>
              )}
            </div>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="off" minLength={6} required />
          </div>
          <Button type="submit" className="w-full gold-gradient text-primary-foreground" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium hover:underline">
            {isLogin ? 'Criar conta' : 'Fazer login'}
          </button>
        </p>
      </motion.div>
    </Shell>
  );
};

// Declarado fora do componente para não ser recriado a cada render
// (caso contrário, o React desmonta os inputs a cada tecla e perde o foco).
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
    <InAppBrowserBanner />
    <div className="relative z-10 flex-1 flex flex-col items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-12">
      <img
        src={logo}
        alt="Vyral Lab"
        className="h-12 sm:h-14 w-auto"
      />
      {children}
    </div>
  </div>
);

export default Auth;
