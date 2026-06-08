"use client";

import { useState } from "react";
import { submitLead } from "./actions";

export default function LeadForm({
  listingId,
  accent = "#1a73e8",
}: {
  listingId: string;
  accent?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await submitLead({ listingId, name, phone, email, message });
    setBusy(false);
    if (res.ok) setDone(true);
    else setErr(res.error ?? "Something went wrong.");
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-green-50 text-green-800 p-4 text-sm text-center">
        Thanks! The agent will reach out shortly.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        required
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <input
        required
        type="tel"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <textarea
        placeholder="Message (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        style={{ background: accent }}
        className="w-full text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "Sending…" : "Request a tour"}
      </button>
    </form>
  );
}
