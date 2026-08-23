"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPost, getToken } from "@/lib/api";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { CatalogResult, ModelCatalogItem } from "@/lib/types";

type WizardStep = "checking" | "select" | "activating" | "complete" | "error";

interface Props {
  onComplete: (modelId: string, mode: string) => void;
  onBack: () => void;
}

export function SetupWizard({ onComplete, onBack }: Props) {
  const { t } = useLang();
  const [step, setStep] = useState<WizardStep>("checking");
  const [catalog, setCatalog] = useState<CatalogResult | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelCatalogItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      setStep("error");
      setError("Not authenticated. Please log in.");
      return;
    }

    apiGet<CatalogResult>("/ai/setup/catalog")
      .then((cat) => {
        setCatalog(cat);
        setStep("select");
      })
      .catch(() => {
        setStep("error");
        setError("Could not load AI models.");
      });
  }, []);

  const handleSelectCloud = useCallback(async (model: ModelCatalogItem) => {
    setSelectedModel(model);
    setStep("activating");

    try {
      await apiPost("/ai/setup/activate", {
        model_id: model.internal_id,
        mode: "cloud",
      });
      setStep("complete");
      onComplete(model.internal_id, "cloud");
    } catch (err: any) {
      setError(err.message || "Failed to activate cloud AI");
      setStep("error");
    }
  }, [onComplete]);

  if (step === "checking") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-stone-600 dark:text-stone-400">Loading BEMUNNA Cloud...</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-center text-sm text-stone-600 dark:text-stone-400">{error}</p>
        <button onClick={onBack} className="rounded-full border border-stone-300 px-6 py-2 text-sm font-medium dark:border-stone-600">
          Go Back
        </button>
      </div>
    );
  }

  if (step === "activating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Activating BEMUNNA Cloud...</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">Please wait a moment.</p>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">BEMUNNA Cloud is Ready!</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          You can now start chatting with BEMUNNA.
        </p>
      </div>
    );
  }

  if (step === "select" && catalog) {
    const cloudModels = catalog.cloud_models || [];
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="text-center">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Choose your BEMUNNA Cloud model
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Select a cloud model to get started.
          </p>
        </div>

        <div className="space-y-3">
          {cloudModels.map((m) => (
            <button
              key={m.internal_id}
              onClick={() => handleSelectCloud(m)}
              className="w-full rounded-xl border-2 border-stone-200 bg-white p-4 text-left transition-all hover:border-blue-400 hover:shadow-md dark:border-stone-700 dark:bg-stone-800 dark:hover:border-blue-500"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100">
                    {m.friendly_name}
                  </h3>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                    {m.description}
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  Cloud
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return null;
}
