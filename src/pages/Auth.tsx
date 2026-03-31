import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import logo from '@/assets/influlab-logo.png';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Digite seu email'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Email de recuperação enviado!');
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setShowConfirmation(true);
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
      <div className="min-h-screen flex flex-col">
        <div className="gradient-header px-4 pt-12 pb-16 rounded-b-3xl text-center">
          <img src={logo} alt="InfluLab" className="h-12 w-auto mx-auto" />
          <h1 className="font-serif text-2xl font-bold text-white mt-4">Verifique seu email ✉️</h1>
        </div>
        <div className="flex-1 flex items-start justify-center px-4 -mt-8">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm">
            <div className="glass-card p-8 text-center space-y-5">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail size={32} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Confirme seu email</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>.
              </p>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">💡 <strong>Não encontrou?</strong> Verifique sua pasta de spam.</p>
              </div>
              <Button onClick={() => { setShowConfirmation(false); setIsLogin(true); setPassword(''); }} className="w-full gold-gradient text-primary-foreground">
                <ArrowLeft size={16} /> Já confirmei, fazer login
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="gradient-header px-4 pt-12 pb-16 rounded-b-3xl text-center">
          <img src={logo} alt="InfluLab" className="h-12 w-auto mx-auto" />
          <h1 className="font-serif text-2xl font-bold text-white mt-4">Recuperar senha 🔑</h1>
          <p className="text-white/60 text-sm mt-1">Digite seu email para receber o link</p>
        </div>
        <div className="flex-1 flex items-start justify-center px-4 -mt-8">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm">
            <form onSubmit={handleForgotPassword} className="glass-card p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="gradient-header px-4 pt-12 pb-16 rounded-b-3xl text-center">
        <img src={logo} alt="InfluLab" className="h-12 w-auto mx-auto" />
        <h1 className="font-serif text-2xl font-bold text-white mt-4">
          {isLogin ? 'Boas-vindas de volta' : 'Crie sua conta'} 👑
        </h1>
        <p className="text-white/60 text-sm mt-1">
          {isLogin ? 'Entre para acessar seu painel' : 'Comece sua jornada de 30 dias'}
        </p>
      </div>
      <div className="flex-1 flex items-start justify-center px-4 -mt-8">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Seu nome</Label>
                <Input id="displayName" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como podemos te chamar?" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
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
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
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
      </div>
    </div>
  );
};

export default Auth;
