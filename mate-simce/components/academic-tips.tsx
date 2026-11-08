"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { academicTips, loadTipSession, saveTipSession, type TipSession } from "@/lib/academic-tips";

function storage() { try { return window.sessionStorage; } catch { return undefined; } }

export function AcademicTips() {
  // El servidor y la primera hidratación usan la misma secuencia; mezclar solo tras montar.
  const [session, setSession] = useState<TipSession>({ order: academicTips.map((_, i) => i), position: 0 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let current = true;
    queueMicrotask(() => {
      if (current) { setSession(loadTipSession(storage())); setReady(true); }
    });
    return () => { current = false; };
  }, []);
  const tip = academicTips[session.order[session.position]];
  function move(direction: number) {
    const next = { ...session, position: (session.position + direction + academicTips.length) % academicTips.length };
    saveTipSession(next, storage()); setSession(next);
  }
  return <aside className="ms-card p-5" aria-labelledby="tips-title">
    <Lightbulb className="mb-3 text-[var(--ms-primary)]" size={24} aria-hidden="true" />
    <h2 id="tips-title" className="font-semibold">Tips académicos</h2>
    <p className="mt-4 text-xs font-medium text-[var(--ms-primary-hover)]">{tip.axis}</p>
    <p data-cy="tip-text" className="mt-2 min-h-24 text-sm leading-6 text-[var(--ms-muted)]">{tip.text}</p>
    <div className="mt-4 flex items-center justify-between gap-2">
      <button type="button" aria-label="Consejo anterior" disabled={!ready} className="rounded-full border border-[var(--ms-border)] p-2" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
      <span data-cy="tip-position" aria-live="polite" className="text-xs text-[var(--ms-muted)]">{session.position + 1} / {academicTips.length}</span>
      <button type="button" aria-label="Consejo siguiente" disabled={!ready} className="rounded-full border border-[var(--ms-border)] p-2" onClick={() => move(1)}><ChevronRight size={16} /></button>
    </div>
  </aside>;
}
