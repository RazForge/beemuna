import { useState, useCallback, useRef } from "react";
import { getToken } from "@/lib/api";

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002/api/v1";

export function useAIStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const streamChat = useCallback(
    async (
      convId: string,
      content: string,
      callbacks: StreamCallbacks
    ) => {
      setIsStreaming(true);
      abortRef.current = new AbortController();
      let fullText = "";

      try {
        const response = await fetch(
          `${API_URL}/ai/conversations/${convId}/messages/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ content }),
            signal: abortRef.current.signal,
            credentials: "include",
          }
        );

        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          try {
            const data = await response.json();
            if (typeof data?.detail === "string") message = data.detail;
          } catch {
            // keep default
          }
          throw new Error(message);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Streaming is not supported by this browser");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                fullText += data.token;
                callbacks.onToken(data.token);
              }
              if (data.done) {
                callbacks.onDone(fullText);
              }
              if (data.error) {
                callbacks.onError(data.error);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          callbacks.onError(err.message || "Stream failed");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { streamChat, isStreaming, stop };
}
