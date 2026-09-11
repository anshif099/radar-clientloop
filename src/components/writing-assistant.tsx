"use client";

import { Check, LoaderCircle, SpellCheck2, X } from "lucide-react";
import { useEffect, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { WritingCorrection } from "@/domain/quality-tools";

type WritingContext = "message" | "feedback" | "title" | "upload-note" | "general";

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return body.message ?? "Writing could not be checked. Please try again.";
}

export function WritingAssistant({ value, onApply, context = "general", disabled = false, compact = false }: {
  value: string;
  onApply: (value: string) => void;
  context?: WritingContext;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ source: string; correction: WritingCorrection } | null>(null);
  const [suggestions, setSuggestions] = useState<{ source: string; word: string; items: string[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const word = value.match(/[A-Za-z']+$/)?.[0] ?? "";
    if (disabled || word.length < 3) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/v1/writing/correct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: word, context, mode: "suggest" }),
          signal: controller.signal,
        });
        if (!response.ok) return setSuggestions(null);
        const body = await response.json() as { suggestions?: unknown };
        const items = Array.isArray(body.suggestions)
          ? body.suggestions.filter((item): item is string => typeof item === "string")
          : [];
        setSuggestions(items.length ? { source: value, word, items } : null);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setSuggestions(null);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [context, disabled, value]);

  const check = async () => {
    const source = value.trim();
    if (!source || checking) return;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/v1/writing/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, context }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const correction = await response.json() as WritingCorrection;
      setResult({ source: value, correction });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Writing could not be checked. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const visibleResult = result?.source === value ? result.correction : null;
  const visibleSuggestions = suggestions?.source === value ? suggestions : null;
  const changed = visibleResult && visibleResult.correctedText !== value;
  return (
    <div className={`writing-assistant${compact ? " compact" : ""}`}>
      {visibleSuggestions ? (
        <div className="writing-suggestions" role="listbox" aria-label={`Suggestions for ${visibleSuggestions.word}`}>
          {visibleSuggestions.items.map((suggestion) => (
            <button key={suggestion} type="button" role="option" aria-selected="false" onClick={() => {
              onApply(`${value.slice(0, -visibleSuggestions.word.length)}${suggestion}`);
              setSuggestions(null);
            }}>{suggestion}</button>
          ))}
        </div>
      ) : null}
      <button className="writing-check-button" type="button" disabled={disabled || checking || !value.trim()} onClick={() => void check()} title="Check spelling and grammar">
        {checking ? <LoaderCircle className="writing-spinner" size={14} /> : <SpellCheck2 size={14} />}
        <span>{checking ? "Checking…" : compact ? "Check writing" : "Fix spelling & grammar"}</span>
      </button>
      {visibleResult ? (
        <div className={changed ? "writing-result changed" : "writing-result correct"} role="status">
          {changed ? <>
            <div><strong>Suggested correction</strong><button type="button" onClick={() => setResult(null)} aria-label="Dismiss suggestion"><X size={14} /></button></div>
            <p>{visibleResult.correctedText}</p>
            {visibleResult.changes.length ? <small>{visibleResult.changes.join(" · ")}</small> : null}
            <button className="writing-apply-button" type="button" onClick={() => { onApply(visibleResult.correctedText); setResult(null); }}><Check size={14} />Apply correction</button>
          </> : <><Check size={15} /><span>Spelling and grammar look good.</span></>}
        </div>
      ) : null}
      {error ? <div className="writing-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button></div> : null}
    </div>
  );
}

type CorrectableInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & {
  defaultValue?: string;
  context?: WritingContext;
};

export function CorrectableInput({ defaultValue = "", context = "general", ...props }: CorrectableInputProps) {
  const [value, setValue] = useState(defaultValue);
  return <div className="writing-field">
    <input {...props} value={value} onChange={(event) => setValue(event.target.value)} spellCheck />
    <WritingAssistant value={value} onApply={(corrected) => setValue(props.maxLength ? corrected.slice(0, props.maxLength) : corrected)} context={context} disabled={props.disabled} />
  </div>;
}

type CorrectableTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange"> & {
  defaultValue?: string;
  context?: WritingContext;
};

export function CorrectableTextarea({ defaultValue = "", context = "general", ...props }: CorrectableTextareaProps) {
  const [value, setValue] = useState(defaultValue);
  return <div className="writing-field">
    <textarea {...props} value={value} onChange={(event) => setValue(event.target.value)} spellCheck />
    <WritingAssistant value={value} onApply={(corrected) => setValue(props.maxLength ? corrected.slice(0, props.maxLength) : corrected)} context={context} disabled={props.disabled} />
  </div>;
}
