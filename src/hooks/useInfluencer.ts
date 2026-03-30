import { useMemo } from 'react';
import { getDailySchedule } from '@/data/dailySchedule';
import { DayStrategy, strategies as fallbackStrategies } from '@/data/strategies';
import { useUserProgress } from './useUserProgress';

export interface DailyTaskState {
  morningInsight: boolean;
  morningPoll: boolean;
  reel: boolean;
  reelEngagement: boolean;
  valueStories: number;
  feedPost: boolean;
  lifestyleStory: boolean;
  cliffhanger: boolean;
}

const defaultTasks: DailyTaskState = {
  morningInsight: false,
  morningPoll: false,
  reel: false,
  reelEngagement: false,
  valueStories: 0,
  feedPost: false,
  lifestyleStory: false,
  cliffhanger: false,
};

export type TaskKey = 'morningInsight' | 'morningPoll' | 'reel' | 'reelEngagement' | 'valueStories' | 'feedPost' | 'lifestyleStory' | 'cliffhanger';

const taskPoints: Record<TaskKey, number> = {
  morningInsight: 5,
  morningPoll: 5,
  reel: 20,
  reelEngagement: 10,
  valueStories: 5,
  feedPost: 15,
  lifestyleStory: 10,
  cliffhanger: 10,
};

function migrateTasks(raw: any): DailyTaskState {
  if (!raw) return { ...defaultTasks };
  if ('morningInsight' in raw) return { ...defaultTasks, ...raw };
  return {
    ...defaultTasks,
    reel: raw.reel ?? false,
    feedPost: raw.feedPost ?? false,
    valueStories: raw.stories ?? 0,
  };
}

export function useInfluencer(strategies?: DayStrategy[]) {
  const strats = strategies || fallbackStrategies;
  const { progress, loading, updateProgress, resetProgress: resetDB } = useUserProgress();

  const state = {
    currentDay: progress.current_day,
    startDate: progress.start_date,
    tasksCompleted: progress.tasks_completed,
    streak: progress.streak,
    influencePoints: progress.influence_points,
  };

  const todayTasks: DailyTaskState = migrateTasks(state.tasksCompleted[state.currentDay]);

  const strategy = strats[state.currentDay - 1];
  const schedule = useMemo(
    () => strategy ? getDailySchedule(state.currentDay, strategy, state.startDate) : null,
    [state.currentDay, strategy, state.startDate]
  );

  const dailyProgress = useMemo(() => {
    if (!schedule) return 0;
    let done = 0;
    let total = 0;
    for (const block of schedule.blocks) {
      for (const task of block.tasks) {
        total++;
        if (task.key === 'valueStories') {
          done += Math.min(todayTasks.valueStories, 5) / 5;
        } else {
          done += (todayTasks[task.key as keyof DailyTaskState] ? 1 : 0);
        }
      }
    }
    total++;
    done += todayTasks.cliffhanger ? 1 : 0;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [todayTasks, schedule]);

  const completeTask = (task: TaskKey) => {
    updateProgress(prev => {
      const current = migrateTasks(prev.tasks_completed[prev.current_day]);
      let updated: DailyTaskState;

      if (task === 'valueStories') {
        if (current.valueStories >= 5) return prev;
        updated = { ...current, valueStories: current.valueStories + 1 };
      } else {
        if (current[task]) return prev;
        updated = { ...current, [task]: true };
      }

      const points = taskPoints[task];

      return {
        ...prev,
        tasks_completed: { ...prev.tasks_completed, [prev.current_day]: updated },
        influence_points: prev.influence_points + points,
      };
    });
  };

  const resetProgress = () => resetDB();

  const completedDays = useMemo(() => {
    return Object.entries(state.tasksCompleted).filter(([, tasks]) => {
      const migrated = migrateTasks(tasks);
      const boolTasks = [migrated.morningInsight, migrated.morningPoll, migrated.reel, migrated.reelEngagement, migrated.lifestyleStory, migrated.cliffhanger];
      const allBools = boolTasks.every(Boolean);
      const storiesDone = migrated.valueStories >= 5;
      return allBools && storiesDone;
    }).map(([day]) => Number(day));
  }, [state.tasksCompleted]);

  return {
    state,
    todayTasks,
    dailyProgress,
    completeTask,
    resetProgress,
    completedDays,
    schedule,
    loading,
  };
}
