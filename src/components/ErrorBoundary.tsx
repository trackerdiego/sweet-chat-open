import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Rótulo curto pra mostrar no fallback (ex.: "Ferramentas", "Painel"). */
  scope?: string;
  /** Fallback custom; se ausente, usa o card padrão. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private autoResetDone = false;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Salva pra debug fácil no console do dispositivo
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__lovable_last_error = { error, info, at: new Date().toISOString() };
    } catch {}
    console.error('[ErrorBoundary]', this.props.scope ?? 'root', error, info.componentStack);

    // Auto-reset em erros de reconciliação (Google Translate / extensões que mutam o DOM).
    // Roda 1x só pra não loopar caso a causa persista.
    const msg = error?.message || '';
    if (!this.autoResetDone && /insertBefore|removeChild|not a child of this node|NotFoundError/i.test(msg)) {
      this.autoResetDone = true;
      setTimeout(() => this.setState({ error: null }), 50);
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
        <div className="max-w-sm w-full glass-card p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-serif text-lg font-semibold">
              Algo deu errado{this.props.scope ? ` em ${this.props.scope}` : ''}
            </h2>
            <p className="text-sm text-muted-foreground">
              Tenta de novo. Se o problema continuar, recarrega o app.
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-2 break-words">
              {error.message}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={this.reset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Tentar de novo
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Recarregar app
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
