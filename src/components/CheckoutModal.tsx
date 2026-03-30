import { useState, useEffect } from "react";
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
import { Loader2, ExternalLink, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function formatCEP(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

type Plan = "monthly" | "yearly";

const plans = {
  monthly: { label: "Mensal", price: 47, cycle: "MONTHLY" as const, perMonth: 47, description: "R$47/mês" },
  yearly: { label: "Anual", price: 397, cycle: "YEARLY" as const, perMonth: 33, description: "R$397/ano (≈ R$33/mês)" },
};

export function CheckoutModal({ open, onOpenChange }: CheckoutModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>("yearly");
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
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const rawCep = cep.replace(/\D/g, "");
    if (rawCep.length !== 8) return;
    const controller = new AbortController();
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${rawCep}/json/`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data.erro) {
          setAddress(data.logradouro || "");
          setBairro(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
        }
      })
      .catch(() => {})
      .finally(() => setCepLoading(false));
    return () => controller.abort();
  }, [cep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpfCnpj = cpfCnpj.replace(/\D/g, "");
    const rawPhone = phone.replace(/\D/g, "");
    const rawCep = cep.replace(/\D/g, "");

    if (!name.trim() || !email.trim() || !rawCpfCnpj || !rawPhone || !rawCep || !address.trim() || !addressNumber.trim() || !bairro.trim() || !city.trim() || !state.trim()) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-subscription", {
        body: {
          name: name.trim(), email: email.trim(), cpfCnpj: rawCpfCnpj, phone: rawPhone,
          postalCode: rawCep, address: address.trim(), addressNumber: addressNumber.trim(),
          complement: complement.trim() || undefined, province: bairro.trim(), plan: selectedPlan,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.paymentUrl) { setPaymentUrl(data.paymentUrl); }
      else { toast({ title: "Erro ao gerar link de pagamento", variant: "destructive" }); }
    } catch (err: any) {
      toast({ title: "Erro no checkout", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleClose = (val: boolean) => {
    if (!val) { setPaymentUrl(null); setName(""); setEmail(""); setCpfCnpj(""); setPhone(""); setCep(""); setAddress(""); setAddressNumber(""); setComplement(""); setBairro(""); setCity(""); setState(""); }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <Crown className="h-5 w-5 text-primary" />
            {paymentUrl ? "Quase lá!" : "Comece sua jornada"}
          </DialogTitle>
          <DialogDescription>
            {paymentUrl ? "Clique no botão abaixo para finalizar o pagamento de forma segura." : "Escolha seu plano e preencha seus dados para começar."}
          </DialogDescription>
        </DialogHeader>

        {paymentUrl ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Você será redirecionada para a página de pagamento segura.</p>
            <Button className="w-full bg-primary hover:bg-primary/90 py-5" onClick={() => window.open(paymentUrl, "_blank")}>
              Ir para pagamento <ExternalLink className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {(["monthly", "yearly"] as Plan[]).map((plan) => {
                const p = plans[plan]; const selected = selectedPlan === plan;
                return (
                  <button key={plan} type="button" onClick={() => setSelectedPlan(plan)} disabled={loading}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${selected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/40"}`}>
                    {plan === "yearly" && <span className="absolute -top-2.5 right-3 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Economize 30%</span>}
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xl font-bold mt-1">R${p.price}<span className="text-xs font-normal text-muted-foreground">/{plan === "yearly" ? "ano" : "mês"}</span></p>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2"><Label>Nome completo</Label><Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>CPF ou CNPJ</Label><Input placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(formatCPF(e.target.value))} disabled={loading} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} disabled={loading} /></div>
            </div>
            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>CEP</Label><div className="relative"><Input placeholder="00000-000" value={cep} onChange={(e) => setCep(formatCEP(e.target.value))} disabled={loading} />{cepLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}</div></div>
                <div className="space-y-2"><Label>Estado</Label><Input placeholder="SP" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} disabled={loading} /></div>
              </div>
              <div className="space-y-2"><Label>Rua</Label><Input placeholder="Rua Exemplo" value={address} onChange={(e) => setAddress(e.target.value)} disabled={loading} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Número</Label><Input placeholder="123" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} disabled={loading} /></div>
                <div className="space-y-2"><Label>Complemento</Label><Input placeholder="Apto 4B" value={complement} onChange={(e) => setComplement(e.target.value)} disabled={loading} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Bairro</Label><Input placeholder="Centro" value={bairro} onChange={(e) => setBairro(e.target.value)} disabled={loading} /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input placeholder="São Paulo" value={city} onChange={(e) => setCity(e.target.value)} disabled={loading} /></div>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 py-5">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando...</> : `Assinar por R$${plans[selectedPlan].price}/${selectedPlan === "yearly" ? "ano" : "mês"}`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
