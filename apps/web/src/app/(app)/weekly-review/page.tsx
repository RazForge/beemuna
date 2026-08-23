"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Target, Calendar, Clock, Trophy, TrendingUp, Zap, Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function WeeklyReviewPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [blockers, setBlockers] = useState("");
  const [wins, setWins] = useState("");
  const [lessons, setLessons] = useState("");

  const reviewQuery = useQuery({
    queryKey: ["weekly-review"],
    queryFn: () => apiGet<any>("/weekly-review"),
  });

  const momentumQuery = useQuery({
    queryKey: ["momentum"],
    queryFn: () => apiGet<any>("/momentum"),
  });

  const createReview = useMutation({
    mutationFn: () => apiPost("/weekly-review", {
      blockers,
      wins,
      lessons,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-review"] });
      toast.success("Weekly review saved");
    },
  });

  const generateAI = useMutation({
    mutationFn: () => apiPost("/ai/weekly-summary", {}),
    onSuccess: (data: any) => {
      toast.success("AI summary generated");
    },
  });

  const review = reviewQuery.data;
  const momentum = momentumQuery.data;

  const getMomentumColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30";
    if (score >= 60) return "text-blue-600 bg-blue-50 dark:bg-blue-900/30";
    if (score >= 40) return "text-amber-600 bg-amber-50 dark:bg-amber-900/30";
    return "text-red-600 bg-red-50 dark:bg-red-900/30";
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Weekly Review</h1>
        <p className="text-muted-foreground mt-1 text-sm">Reflect, learn, and plan for growth</p>
      </div>

      {/* Momentum Score */}
      {momentum && (
        <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Momentum Score</h2>
              <p className="text-sm text-muted-foreground">Based on tasks, habits, goals, and focus</p>
            </div>
            <div className={cn("rounded-2xl px-6 py-3 text-center", getMomentumColor(momentum.score))}>
              <p className="text-3xl font-bold">{momentum.score}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider">out of 100</p>
            </div>
          </div>
          <Progress value={momentum.score} className="h-3 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Tasks</p>
                <p className="text-sm font-bold">{momentum.tasks_completed || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Habits</p>
                <p className="text-sm font-bold">{Math.round(momentum.habit_completion_pct || 0)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Focus</p>
                <p className="text-sm font-bold">{momentum.focus_hours || 0}h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Achievements</p>
                <p className="text-sm font-bold">{momentum.achievements_earned || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {momentum?.ai_insights && momentum.ai_insights.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">AI Insights</h3>
          </div>
          <div className="space-y-2">
            {momentum.ai_insights.map((insight: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Review Form */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-semibold">This Week&apos;s Review</h3>

        <div className="space-y-2">
          <Label>Wins & Achievements</Label>
          <Textarea
            placeholder="What went well this week?"
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Blockers & Challenges</Label>
          <Textarea
            placeholder="What slowed you down?"
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Lessons Learned</Label>
          <Textarea
            placeholder="What will you do differently next week?"
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => createReview.mutate()} loading={createReview.isPending}>
            Save Review
          </Button>
          <Button variant="outline" onClick={() => generateAI.mutate()} loading={generateAI.isPending}>
            <Brain className="h-4 w-4 mr-1.5" /> AI Summary
          </Button>
        </div>
      </div>
    </div>
  );
}
