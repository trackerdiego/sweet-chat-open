import { ScriptGenerator } from '@/components/ScriptGenerator';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserProfile } from '@/hooks/useUserProfile';

const Script = () => {
  const { strategies } = useUserStrategies();
  const { state } = useInfluencer(strategies);
  const { profile } = useUserProfile();
  const todayStrategy = strategies[state.currentDay - 1];

  return (
    <div className="min-h-screen pb-24 md:pt-20 px-4 max-w-lg mx-auto pt-6">
      <ScriptGenerator
        strategy={todayStrategy}
        primaryNiche={profile?.primary_niche}
        contentStyle={profile?.content_style}
      />
    </div>
  );
};

export default Script;
