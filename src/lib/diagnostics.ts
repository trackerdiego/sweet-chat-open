import { supabase } from '@/integrations/supabase/client';
import { CHECKOUT_PLAN_KEY, CHECKOUT_DRAFT_KEY } from '@/lib/checkoutStorage';

type DiagEvent = 'checkout_opened' | 'access_guard_blocked' | 'auto_opener_fired';

/**
 * Loga um evento de diagnóstico na tabela public.client_diagnostics.
 * Silencioso: nunca joga erro pra UI. No-op se não houver sessão.
 */
export async function logDiagnostic(
  event: DiagEvent,
  source: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let pendingPlan: string | null = null;
    let checkoutDraft: string | null = null;
    try {
      pendingPlan = sessionStorage.getItem(CHECKOUT_PLAN_KEY);
      checkoutDraft = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    } catch {}

    const payload = {
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      sessionStorage: {
        [CHECKOUT_PLAN_KEY]: pendingPlan,
        [CHECKOUT_DRAFT_KEY]: checkoutDraft ? checkoutDraft.slice(0, 500) : null,
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ts: new Date().toISOString(),
      ...extra,
    };

    await (supabase.from as any)('client_diagnostics').insert({
      user_id: user.id,
      event,
      source,
      payload,
    });
  } catch {
    // silencioso
  }
}
