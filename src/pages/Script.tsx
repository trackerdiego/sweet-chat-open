import { ScriptGenerator } from '@/components/ScriptGenerator';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Skeleton } from '@/components/ui/skeleton';

const Script = () => {
  const { strategies, loading } = useUserStrategies();
  const { state } = useInfluencer(strategies);
  const { profile } = useUserProfile();
  const todayStrategy = strategies[state.currentDay - 1];

  if (loading || strategies.length === 0) {
    return (
      <div className="min-h-screen pb-24 md:pt-20 px-4 max-w-lg mx-auto pt-6 space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pt-20 px-4 max-w-lg mx-auto pt-6">
      {todayStrategy && (
        <ScriptGenerator
          strategy={todayStrategy}
          primaryNiche={profile?.primary_niche}
          contentStyle={profile?.content_style}
        />
      )}
    </div>
  );
};

export default Script;
