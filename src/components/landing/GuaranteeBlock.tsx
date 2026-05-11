import { ShieldCheck } from "lucide-react";

export function GuaranteeBlock() {
  return (
    <section className="py-16 px-4 bg-background">
      <div className="container max-w-3xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/5 p-8 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-serif text-2xl sm:text-3xl font-bold mb-3" style={{ textWrap: "balance" }}>
            Risco zero por 7 dias
          </h3>
          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Teste o InfluLab por 7 dias. Se você não amar a estratégia que a IA
            criar pra você, devolvemos 100% do seu dinheiro — sem perguntas, sem
            burocracia.
          </p>
        </div>
      </div>
    </section>
  );
}
