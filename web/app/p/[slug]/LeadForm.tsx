"use client";

import { useState } from "react";
import { submitLead } from "./actions";

export default function LeadForm({
  listingId,
  accent = "#eb5e28",
  label = "Request a tour",
  busyLabel = "Sending…",
  // Quiz context, when this form is rendered after the floor-plan finder.
  recommendation,
  quizSummary,
}: {
  listingId: string;
  accent?: string;
  label?: string;
  busyLabel?: string;
  recommendation?: string;
  quizSummary?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot — real users never fill this
  const [renderedAt] = useState(() => Date.now()); // time-trap baseline
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await submitLead({
      listingId,
      name,
      phone,
      email,
      message,
      recommendation,
      quizSummary,
      hp,
      t: renderedAt,
    });
    setBusy(false);
    if (res.ok) setDone(true);
    else setErr(res.error ?? "Something went wrong.");
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 p-4 text-sm text-center font-medium">
        Thanks! The agent will reach out shortly.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {/* honeypot: hidden from humans, bots tend to fill it */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <input
        required
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input w-full"
      />
      <input
        required
        type="tel"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="input w-full"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input w-full"
      />
      <textarea
        placeholder="Message (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="input w-full"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        style={{ background: accent }}
        className="w-full text-white rounded-xl py-3 text-sm font-semibold shadow-sm disabled:opacity-60 transition active:translate-y-px"
      >
        {busy ? busyLabel : label}
      </button>
    </form>
  );
}
