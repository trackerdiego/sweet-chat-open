import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Crown, QrCode, CreditCard, Copy, CheckCircle2,
  ArrowRight, ArrowLeft, ShieldCheck, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useCheckoutDraft } from "@/hooks/useCheckoutDraft";
import { BonusStack } from "@/components/checkout/BonusStack";
import { UrgencyBar } from "@/components/checkout/UrgencyBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcInstallment, formatBRL, MAX_INSTALLMENTS } from "@/lib/installments";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlan?: "monthly" | "yearly";
}

type Plan = "monthly" | "yearly";
type Method = "PIX" | "CREDIT_CARD";

const plans = {
  monthly: { label: "Mensal", price: 47, sub: "cobrado mensalmente" },
  yearly: { label: "Anual", price: 297, sub: "≈ R$ 24,75/mês • 47% OFF" },
};

const fmt = {
  cpf: (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.length <= 11
      ? d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      : d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  },
  phone: (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d.length <= 10
      ? d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2")
      : d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  },
  cep: (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2"),
  card: (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "),
  exp: (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
  },
};

export function CheckoutModal({ open, onOpenChange, initialPlan }: CheckoutModalProps) {
  const { toast } = useToast();
  const { isActive, refresh } = useSubscription();
  const { draft, update, setDraft, clear } = useCheckoutDraft(initialPlan);

  // dados do cartão ficam só em memória (PCI — nunca persistir)
  const [ccName, setCcName] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccExp, setCcExp] = useState("");
  const [ccCvv, setCcCvv] = useState("");

  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cardApproved, setCardApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const pollRef = useRef<number | null>(null);

  // ajusta plano quando initialPlan muda
  useEffect(() => {
    if (open && initialPlan && draft.step === "data" && !draft.pix) {
      update("selectedPlan", initialPlan);
    }
  }, [open, initialPlan]);

  // preenche email do user logado + detecta admin
  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        if (!draft.email) update("email", user.email);
        setIsAdmin(user.email.toLowerCase() === "agentevendeagente@gmail.com");
      }
    });
  }, [open]);

  // CEP autofill
  useEffect(() => {
    const raw = draft.cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    const ctrl = new AbortController();
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${raw}/json/`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!d.erro) {
          setDraft((cur) => ({
            ...cur,
            address: d.logradouro || cur.address,
            bairro: d.bairro || cur.bairro,
            city: d.localidade || cur.city,
            state: d.uf || cur.state,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setCepLoading(false));
    return () => ctrl.abort();
  }, [draft.cep]);

  // Polling enquanto aguarda confirmar
  useEffect(() => {
    if (draft.step !== "result") return;
    pollRef.current = window.setInterval(() => { refresh(); }, 4000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [draft.step, refresh]);

  // Fecha sozinho quando vira ativo
  useEffect(() => {
    if (isActive && draft.step === "result") {
      toast({ title: "Pagamento confirmado!", description: "Liberando seu acesso..." });
      setTimeout(() => { clear(); onOpenChange(false); }, 1200);
    }
  }, [isActive, draft.step]);

  const handleClose = (val: boolean) => {
    if (!val && pollRef.current) window.clearInterval(pollRef.current);
    onOpenChange(val);
    // NÃO limpa o draft ao fechar — preserva pra próxima abertura
  };

  const handleReset = () => {
    clear();
    setCcName(""); setCcNumber(""); setCcExp(""); setCcCvv("");
    setCardApproved(false);
  };

  const validateData = () => {
    const d = draft;
    const ok = d.name.trim() && d.email.trim() && d.cpfCnpj.replace(/\D/g, "")
      && d.phone.replace(/\D/g, "") && d.cep.replace(/\D/g, "")
      && d.address.trim() && d.addressNumber.trim() && d.bairro.trim() && d.city.trim() && d.state.trim();
    if (!ok) toast({ title: "Preencha todos os campos", variant: "destructive" });
    return !!ok;
  };

  const submit = async () => {
    setLoading(true);
    try {
      const payload: any = {
        name: draft.name.trim(), email: draft.email.trim(),
        cpfCnpj: draft.cpfCnpj.replace(/\D/g, ""),
        phone: draft.phone.replace(/\D/g, ""),
        postalCode: draft.cep.replace(/\D/g, ""),
        address: draft.address.trim(), addressNumber: draft.addressNumber.trim(),
        complement: draft.complement.trim() || undefined,
        province: draft.bairro.trim(), plan: draft.selectedPlan,
        paymentMethod: draft.method,
      };
      if (draft.method === "CREDIT_CARD") {
        if (!ccName.trim() || !ccNumber || !ccExp || !ccCvv) {
          toast({ title: "Preencha os dados do cartão", variant: "destructive" });
          setLoading(false); return;
        }
        const [mm, yy] = ccExp.split("/");
        payload.creditCard = {
          holderName: ccName.trim(),
          number: ccNumber.replace(/\s/g, ""),
          expiryMonth: mm, expiryYear: yy, ccv: ccCvv,
        };
        if (draft.selectedPlan === "yearly") {
          payload.installmentCount = draft.installmentCount || 1;
        }
      }
      const { data, error } = await supabase.functions.invoke("create-asaas-subscription", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (draft.method === "PIX" && data?.pix?.encodedImage) {
        setDraft((c) => ({
          ...c,
          pix: { encodedImage: data.pix.encodedImage, payload: data.pix.payload },
          step: "result",
        }));
      } else if (draft.method === "CREDIT_CARD") {
        setCardApproved(true);
        update("step", "result");
        refresh();
      } else {
        toast({ title: "Pagamento iniciado", description: "Aguardando confirmação." });
        update("step", "result");
      }
    } catch (err: any) {
      toast({ title: "Erro no pagamento", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const copyPix = async () => {
    if (!draft.pix?.payload) return;
    try {
      await navigator.clipboard.writeText(draft.pix.payload);
      toast({ title: "Código PIX copiado!" });
    } catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  };

  const planPrice = plans[draft.selectedPlan].price;
  const stepIdx = draft.step === "data" ? 0 : draft.step === "method" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto border-primary/30 bg-card/95 backdrop-blur-xl shadow-[0_24px_70px_-20px_hsl(var(--primary)/0.5)] p-0">
        {/* Lilac gradient header */}
        <div className="relative px-6 pt-6 pb-5 gradient-header rounded-t-lg overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-12 -left-8 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
          </div>
          <DialogHeader className="relative space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/30 flex items-center justify-center shadow-lg">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <DialogTitle className="font-display font-bold text-lg tracking-tight text-white">
                  {draft.step === "data" && "Garanta seu acesso"}
                  {draft.step === "method" && "Escolha como pagar"}
                  {draft.step === "result" && (draft.pix ? "Quase lá — pague o PIX" : cardApproved ? "Tudo certo!" : "Processando...")}
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80">
                  {draft.step === "data" && "Dados para emitir a cobrança segura"}
                  {draft.step === "method" && "PIX libera na hora • Cartão é recorrente"}
                  {draft.step === "result" && (draft.pix ? "Escaneie ou copie o código abaixo" : "Aguarde a confirmação")}
                </DialogDescription>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {["Dados", "Pagamento", "Confirmação"].map((label, i) => (
                <div key={label} className="flex-1 flex items-center gap-1.5">
                  <div className={`h-1.5 flex-1 rounded-full transition-all ${
                    i <= stepIdx ? "bg-white" : "bg-white/25"
                  }`} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold">
              <span className={stepIdx >= 0 ? "text-white" : "text-white/50"}>Dados</span>
              <span className={stepIdx >= 1 ? "text-white" : "text-white/50"}>Pagamento</span>
              <span className={stepIdx >= 2 ? "text-white" : "text-white/50"}>Confirmação</span>
            </div>
          </DialogHeader>
        </div>


        <div className="px-6 pb-6 space-y-4">
          <AnimatePresence mode="wait">
            {draft.step === "data" && (
              <motion.div key="data" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <UrgencyBar />
                <BonusStack price={planPrice} />

                {/* Plano */}
                <div className="grid grid-cols-2 gap-2.5">
                  {(["yearly", "monthly"] as Plan[]).map((pl) => {
                    const p = plans[pl]; const sel = draft.selectedPlan === pl;
                    return (
                      <button key={pl} type="button" onClick={() => update("selectedPlan", pl)}
                        className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                          sel
                            ? "border-primary bg-primary/10 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)]"
                            : "border-border/60 hover:border-primary/40 bg-background/40"
                        }`}>
                        {pl === "yearly" && (
                          <span className="absolute -top-2 right-2 text-[9px] font-bold gold-gradient text-primary-foreground px-2 py-0.5 rounded-full shadow">
                            MAIS ESCOLHIDO
                          </span>
                        )}
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.label}</p>
                        <p className="text-xl font-bold mt-0.5 text-orange-500">R${p.price}</p>
                        <p className="text-[10px] text-primary font-medium mt-0.5">{p.sub}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Dados pessoais */}
                <div className="space-y-3">
                  <Field label="Nome completo"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="Seu nome" value={draft.name} onChange={(e) => update("name", e.target.value)} /></Field>
                  <Field label="E-mail"><Input type="email" className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="seu@email.com" value={draft.email} onChange={(e) => update("email", e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CPF / CNPJ"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="000.000.000-00" value={draft.cpfCnpj} onChange={(e) => update("cpfCnpj", fmt.cpf(e.target.value))} /></Field>
                    <Field label="Telefone"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="(00) 00000-0000" value={draft.phone} onChange={(e) => update("phone", fmt.phone(e.target.value))} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CEP">
                      <div className="relative">
                        <Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="00000-000" value={draft.cep} onChange={(e) => update("cep", fmt.cep(e.target.value))} />
                        {cepLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </Field>
                    <Field label="Estado"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="SP" maxLength={2} value={draft.state} onChange={(e) => update("state", e.target.value.toUpperCase())} /></Field>
                  </div>
                  <Field label="Rua"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="Rua Exemplo" value={draft.address} onChange={(e) => update("address", e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Número"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="123" value={draft.addressNumber} onChange={(e) => update("addressNumber", e.target.value)} /></Field>
                    <Field label="Complemento"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="Apto 4B" value={draft.complement} onChange={(e) => update("complement", e.target.value)} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bairro"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="Centro" value={draft.bairro} onChange={(e) => update("bairro", e.target.value)} /></Field>
                    <Field label="Cidade"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="São Paulo" value={draft.city} onChange={(e) => update("city", e.target.value)} /></Field>
                  </div>
                </div>

                <Button onClick={() => validateData() && update("step", "method")}
                  className="w-full gold-gradient text-primary-foreground gap-2 h-12 font-semibold shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6)] hover:scale-[1.01] transition-transform">
                  Continuar <ArrowRight size={18} />
                </Button>

                <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-primary mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">7 dias de garantia</p>
                    <p className="text-muted-foreground">Se não amar, devolvemos 100%. Sem perguntas.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {draft.step === "method" && (
              <motion.div key="method" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <BonusStack price={planPrice} />

                <Tabs value={draft.method} onValueChange={(v) => update("method", v as Method)}>
                  <TabsList className="grid grid-cols-2 w-full bg-background/40 border border-border/60">
                    <TabsTrigger value="PIX" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-2">
                      <QrCode size={16} /> PIX
                    </TabsTrigger>
                    <TabsTrigger value="CREDIT_CARD" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-2">
                      <CreditCard size={16} /> Cartão
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="PIX" className="space-y-3 pt-4">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
                      <p className="font-semibold flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Libera o acesso em segundos</p>
                      <p className="text-muted-foreground text-xs">Você verá o QR Code e o código copia-e-cola na próxima tela. Renovação por PIX a cada ciclo.</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="CREDIT_CARD" className="space-y-3 pt-4">
                    <Field label="Nome no cartão"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="Como está impresso" value={ccName} onChange={(e) => setCcName(e.target.value)} /></Field>
                    <Field label="Número do cartão"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="0000 0000 0000 0000" value={ccNumber} onChange={(e) => setCcNumber(fmt.card(e.target.value))} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Validade"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="MM/AA" value={ccExp} onChange={(e) => setCcExp(fmt.exp(e.target.value))} /></Field>
                      <Field label="CVV"><Input className="bg-background/60 border-border/60 focus-visible:border-primary focus-visible:ring-primary/30" placeholder="123" maxLength={4} value={ccCvv} onChange={(e) => setCcCvv(e.target.value.replace(/\D/g, ""))} /></Field>
                    </div>
                    {draft.selectedPlan === "yearly" && (
                      <Field label="Parcelas">
                        <Select
                          value={String(draft.installmentCount || 1)}
                          onValueChange={(v) => update("installmentCount", Number(v))}
                        >
                          <SelectTrigger className="bg-background/60 border-border/60 focus:border-primary focus:ring-primary/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => {
                              const c = calcInstallment(i + 1);
                              return (
                                <SelectItem key={c.installments} value={String(c.installments)}>
                                  {c.installments}x de {formatBRL(c.per)}{" "}
                                  {c.hasInterest
                                    ? `(total ${formatBRL(c.total)})`
                                    : "sem juros"}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck size={12} /> Cobrança segura via Asaas. Renovação automática a cada ciclo.
                    </p>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" onClick={() => update("step", "data")} className="gap-1" disabled={loading}>
                    <ArrowLeft size={16} /> Voltar
                  </Button>
                  <Button onClick={submit} disabled={loading}
                    className="flex-1 gold-gradient text-primary-foreground gap-2 h-12 font-semibold shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6)] hover:scale-[1.01] transition-transform">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                      : <>{draft.method === "PIX"
                            ? "Gerar PIX"
                            : draft.selectedPlan === "yearly" && (draft.installmentCount || 1) > 1
                              ? `Pagar ${draft.installmentCount}x de ${formatBRL(calcInstallment(draft.installmentCount).per)}`
                              : `Pagar R$${planPrice}`} <ArrowRight size={18} /></>}
                  </Button>
                </div>
              </motion.div>
            )}

            {draft.step === "result" && (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {draft.pix && !isActive && (
                  <>
                    <div className="mx-auto rounded-2xl bg-white p-4 w-fit shadow-[0_8px_30px_-10px_hsl(var(--primary)/0.5)] ring-1 ring-primary/20">
                      <img src={`data:image/png;base64,${draft.pix.encodedImage}`} alt="QR Code PIX" className="w-56 h-56" />
                    </div>

                    <ol className="space-y-2 text-sm">
                      {["Abra o app do seu banco", "Escolha PIX → Pagar com QR Code ou Copia e Cola", "Confirme — acesso libera automaticamente"].map((t, i) => (
                        <li key={t} className="flex gap-2.5 items-start">
                          <span className="h-5 w-5 rounded-full gold-gradient text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                          <span className="text-foreground/90">{t}</span>
                        </li>
                      ))}
                    </ol>

                    <Button onClick={copyPix} className="w-full gold-gradient text-primary-foreground gap-2 h-12 font-semibold shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6)]">
                      <Copy size={18} /> Copiar código PIX
                    </Button>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ou copie manualmente</Label>
                      <Input readOnly value={draft.pix.payload} className="bg-background/60 border-border/60 text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm flex items-center gap-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <span className="text-muted-foreground">Aguardando confirmação — costuma cair em até 10s.</span>
                    </div>

                    <button onClick={handleReset} className="w-full text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                      Recomeçar com outros dados
                    </button>
                  </>
                )}
                {cardApproved && !isActive && (
                  <div className="text-center py-6 space-y-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">Confirmando seu cartão com o banco...</p>
                  </div>
                )}
                {isActive && (
                  <div className="text-center py-8 space-y-3">
                    <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
                    <p className="font-bold text-lg">Pagamento aprovado!</p>
                    <p className="text-sm text-muted-foreground">Liberando seu acesso...</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      {children}
    </div>
  );
}
