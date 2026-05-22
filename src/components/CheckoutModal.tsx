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
  ArrowRight, ArrowLeft, Sparkles, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlan?: "monthly" | "yearly";
}

type Plan = "monthly" | "yearly";
type Step = "data" | "method" | "result";
type Method = "PIX" | "CREDIT_CARD";

const plans = {
  monthly: { label: "Mensal", price: 47 },
  yearly: { label: "Anual", price: 297 },
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

  const [step, setStep] = useState<Step>("data");
  const [selectedPlan, setSelectedPlan] = useState<Plan>(initialPlan ?? "yearly");
  const [method, setMethod] = useState<Method>("PIX");

  // dados
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [bairro, setBairro] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // cartão
  const [ccName, setCcName] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccExp, setCcExp] = useState("");
  const [ccCvv, setCcCvv] = useState("");

  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [pix, setPix] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [cardApproved, setCardApproved] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => { if (open && initialPlan) setSelectedPlan(initialPlan); }, [open, initialPlan]);

  useEffect(() => {
    if (open) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email && !email) setEmail(user.email);
      });
    }
  }, [open]);

  // CEP autofill
  useEffect(() => {
    const raw = cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    const ctrl = new AbortController();
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${raw}/json/`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!d.erro) {
          setAddress(d.logradouro || "");
          setBairro(d.bairro || "");
          setCity(d.localidade || "");
          setState(d.uf || "");
        }
      })
      .catch(() => {})
      .finally(() => setCepLoading(false));
    return () => ctrl.abort();
  }, [cep]);

  // Polling enquanto aguarda PIX/Cartão confirmar
  useEffect(() => {
    if (step !== "result") return;
    pollRef.current = window.setInterval(() => { refresh(); }, 4000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [step, refresh]);

  // Fecha sozinho quando vira ativo
  useEffect(() => {
    if (isActive && step === "result") {
      toast({ title: "Pagamento confirmado!", description: "Liberando seu acesso..." });
      setTimeout(() => onOpenChange(false), 1200);
    }
  }, [isActive, step]);

  const resetAll = () => {
    setStep("data"); setMethod("PIX"); setName(""); setEmail(""); setCpfCnpj("");
    setPhone(""); setCep(""); setAddress(""); setAddressNumber(""); setComplement("");
    setBairro(""); setCity(""); setState(""); setCcName(""); setCcNumber("");
    setCcExp(""); setCcCvv(""); setPix(null); setCardApproved(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) { if (pollRef.current) window.clearInterval(pollRef.current); resetAll(); }
    onOpenChange(val);
  };

  const validateData = () => {
    const ok = name.trim() && email.trim() && cpfCnpj.replace(/\D/g, "")
      && phone.replace(/\D/g, "") && cep.replace(/\D/g, "")
      && address.trim() && addressNumber.trim() && bairro.trim() && city.trim() && state.trim();
    if (!ok) toast({ title: "Preencha todos os campos", variant: "destructive" });
    return !!ok;
  };

  const submit = async () => {
    setLoading(true);
    try {
      const payload: any = {
        name: name.trim(), email: email.trim(),
        cpfCnpj: cpfCnpj.replace(/\D/g, ""),
        phone: phone.replace(/\D/g, ""),
        postalCode: cep.replace(/\D/g, ""),
        address: address.trim(), addressNumber: addressNumber.trim(),
        complement: complement.trim() || undefined,
        province: bairro.trim(), plan: selectedPlan,
        paymentMethod: method,
      };
      if (method === "CREDIT_CARD") {
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
      }
      const { data, error } = await supabase.functions.invoke("create-asaas-subscription", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (method === "PIX" && data?.pix?.encodedImage) {
        setPix({ encodedImage: data.pix.encodedImage, payload: data.pix.payload });
        setStep("result");
      } else if (method === "CREDIT_CARD") {
        setCardApproved(true);
        setStep("result");
        refresh();
      } else {
        toast({ title: "Pagamento iniciado", description: "Aguardando confirmação." });
        setStep("result");
      }
    } catch (err: any) {
      toast({ title: "Erro no pagamento", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const copyPix = async () => {
    if (!pix?.payload) return;
    try {
      await navigator.clipboard.writeText(pix.payload);
      toast({ title: "Código PIX copiado!" });
    } catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  };

  const planPrice = plans[selectedPlan].price;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.35)]">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent pointer-events-none rounded-t-lg" />
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <Crown className="h-5 w-5 text-primary" />
            {step === "data" && "Comece sua jornada"}
            {step === "method" && "Como prefere pagar?"}
            {step === "result" && (pix ? "Pague com PIX" : cardApproved ? "Tudo certo!" : "Processando...")}
          </DialogTitle>
          <DialogDescription>
            {step === "data" && "Seus dados para gerar a cobrança segura."}
            {step === "method" && "PIX libera na hora. Cartão é recorrente."}
            {step === "result" && (pix ? "Escaneie ou copie o código abaixo." : "Aguarde a confirmação.")}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "data" && (
            <motion.div key="data" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4 pt-2">
              {/* Plano */}
              <div className="grid grid-cols-2 gap-3">
                {(["yearly", "monthly"] as Plan[]).map((pl) => {
                  const p = plans[pl]; const sel = selectedPlan === pl;
                  return (
                    <button key={pl} type="button" onClick={() => setSelectedPlan(pl)}
                      className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                        sel
                          ? "border-primary bg-primary/10 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)]"
                          : "border-border/60 hover:border-primary/40 bg-background/40"
                      }`}>
                      {pl === "yearly" && (
                        <span className="absolute -top-2.5 right-3 text-[10px] font-bold gold-gradient text-primary-foreground px-2 py-0.5 rounded-full shadow">
                          47% OFF
                        </span>
                      )}
                      <p className="text-sm font-semibold">{p.label}</p>
                      <p className="text-xl font-bold mt-1">R${p.price}
                        <span className="text-xs font-normal text-muted-foreground">/{pl === "yearly" ? "ano" : "mês"}</span>
                      </p>
                      {pl === "yearly" && <p className="text-[11px] text-primary font-medium mt-0.5">≈ R$24,75/mês</p>}
                      {pl === "monthly" && <p className="text-[11px] text-muted-foreground mt-0.5">cobrado mensalmente</p>}
                    </button>
                  );
                })}
              </div>

              {/* Dados pessoais */}
              <div className="space-y-3">
                <Field label="Nome completo"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="E-mail"><Input type="email" className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CPF ou CNPJ"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(fmt.cpf(e.target.value))} /></Field>
                  <Field label="Telefone"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(fmt.phone(e.target.value))} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CEP">
                    <div className="relative">
                      <Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="00000-000" value={cep} onChange={(e) => setCep(fmt.cep(e.target.value))} />
                      {cepLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </Field>
                  <Field label="Estado"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="SP" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} /></Field>
                </div>
                <Field label="Rua"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="Rua Exemplo" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Número"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="123" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} /></Field>
                  <Field label="Complemento"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="Apto 4B" value={complement} onChange={(e) => setComplement(e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bairro"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="Centro" value={bairro} onChange={(e) => setBairro(e.target.value)} /></Field>
                  <Field label="Cidade"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="São Paulo" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                </div>
              </div>

              <Button onClick={() => validateData() && setStep("method")}
                className="w-full gold-gradient text-primary-foreground gap-2 h-11 hover:scale-[1.01] transition-transform">
                Continuar <ArrowRight size={18} />
              </Button>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <ShieldCheck size={12} /> Pagamento processado pela Asaas. Cancele quando quiser.
              </p>
            </motion.div>
          )}

          {step === "method" && (
            <motion.div key="method" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4 pt-2">
              <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
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
                    <p className="font-medium flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Libera o acesso em segundos</p>
                    <p className="text-muted-foreground text-xs">Você verá o QR Code e o código copia-e-cola na próxima tela. Renovação por PIX a cada ciclo.</p>
                  </div>
                </TabsContent>

                <TabsContent value="CREDIT_CARD" className="space-y-3 pt-4">
                  <Field label="Nome no cartão"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="Como está impresso" value={ccName} onChange={(e) => setCcName(e.target.value)} /></Field>
                  <Field label="Número do cartão"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="0000 0000 0000 0000" value={ccNumber} onChange={(e) => setCcNumber(fmt.card(e.target.value))} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Validade"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="MM/AA" value={ccExp} onChange={(e) => setCcExp(fmt.exp(e.target.value))} /></Field>
                    <Field label="CVV"><Input className="bg-background/60 border-border/60 focus-visible:border-primary" placeholder="123" maxLength={4} value={ccCvv} onChange={(e) => setCcCvv(e.target.value.replace(/\D/g, ""))} /></Field>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck size={12} /> Cobrança recorrente segura via Asaas.
                  </p>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep("data")} className="gap-1" disabled={loading}>
                  <ArrowLeft size={16} /> Voltar
                </Button>
                <Button onClick={submit} disabled={loading}
                  className="flex-1 gold-gradient text-primary-foreground gap-2 h-11 hover:scale-[1.01] transition-transform">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                    : <>{method === "PIX" ? "Gerar PIX" : `Pagar R$${planPrice}`} <ArrowRight size={18} /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "result" && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2">
              {pix && (
                <>
                  <div className="mx-auto rounded-2xl bg-white p-4 w-fit shadow-[0_8px_30px_-10px_hsl(var(--primary)/0.4)]">
                    <img src={`data:image/png;base64,${pix.encodedImage}`} alt="QR Code PIX" className="w-56 h-56" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">PIX copia-e-cola</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={pix.payload} className="bg-background/60 border-border/60 text-xs font-mono" />
                      <Button type="button" variant="outline" size="icon" onClick={copyPix}><Copy size={16} /></Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">Aguardando confirmação do pagamento...</span>
                  </div>
                </>
              )}
              {cardApproved && !isActive && (
                <div className="text-center py-6 space-y-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Confirmando seu cartão com o banco...</p>
                </div>
              )}
              {isActive && (
                <div className="text-center py-6 space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                  <p className="font-semibold">Pagamento aprovado!</p>
                  <p className="text-sm text-muted-foreground">Liberando seu acesso...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
