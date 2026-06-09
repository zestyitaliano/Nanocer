// Lead notification dispatch. Best-effort: every path is wrapped so a failure
// here can never break the visitor's form submission. Runs server-side with the
// service-role admin client (it needs to read the owner's auth email and prefs,
// which are not visible to the anonymous submitter).
//
// Twilio/SMS will slot in here later behind the same resolve-recipient logic.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendLeadEmail, sendEscalationEmail } from "@/lib/email/resend";
import type { Lead, TeamRole } from "@/lib/types";

export async function notifyNewLead(listingId: string, leadId: number): Promise<void> {
  try {
    const admin = createAdminClient();

    // Resolve the listing → owner. Also grab the name for the email subject.
    const { data: listing } = await admin
      .from("listings")
      .select("id, name, user_id")
      .eq("id", listingId)
      .maybeSingle();
    if (!listing?.user_id) return;

    // Owner notification prefs (row may not exist → defaults: email on, no override).
    const { data: prefs } = await admin
      .from("notification_prefs")
      .select("email_enabled, email_to")
      .eq("user_id", listing.user_id)
      .maybeSingle();

    if (prefs && prefs.email_enabled === false) return;

    // Recipient: explicit override, else the owner's auth email.
    let to = prefs?.email_to?.trim() || "";
    if (!to) {
      const { data: userRes } = await admin.auth.admin.getUserById(listing.user_id);
      to = userRes?.user?.email?.trim() || "";
    }
    if (!to) return;

    // Fetch the captured lead so the email shows exactly what was stored.
    const { data: lead } = await admin
      .from("leads")
      .select("name, phone, email, message, source")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return;

    await sendLeadEmail({
      to,
      listingId: listing.id,
      listingName: listing.name || "your listing",
      lead: lead as Pick<Lead, "name" | "phone" | "email" | "message" | "source">,
    });
  } catch (e) {
    // Never propagate — notification is best-effort.
    console.warn("[notify] notifyNewLead failed:", e);
  }
}

// Role priority when picking who to escalate an uncontacted lead to.
const ESCALATION_PRIORITY: TeamRole[] = ["senior_staff", "property_manager"];

// Emails senior staff (then PM, then the owner as fallback) about an uncontacted
// lead. Returns the user id it escalated to (for stamping leads.escalated_to), or
// null if it couldn't notify anyone. Never throws.
export async function notifyEscalation(
  listingId: string,
  leadId: number,
): Promise<{ escalatedTo: string | null }> {
  try {
    const admin = createAdminClient();

    const { data: listing } = await admin
      .from("listings")
      .select("id, name, user_id, portfolio_id")
      .eq("id", listingId)
      .maybeSingle();
    if (!listing) return { escalatedTo: null };

    const { data: lead } = await admin
      .from("leads")
      .select("name, phone, email, created_at")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return { escalatedTo: null };

    // Build the recipient list: senior_staff + property_manager in the portfolio,
    // falling back to the listing owner when there's no team.
    const recipients: string[] = [];
    if (listing.portfolio_id) {
      const { data: members } = await admin
        .from("portfolio_members")
        .select("user_id, role")
        .eq("portfolio_id", listing.portfolio_id)
        .in("role", ESCALATION_PRIORITY);
      // Sort by priority so escalated_to is the most senior available.
      (members ?? [])
        .sort(
          (a, b) =>
            ESCALATION_PRIORITY.indexOf(a.role as TeamRole) -
            ESCALATION_PRIORITY.indexOf(b.role as TeamRole),
        )
        .forEach((m) => recipients.push(m.user_id as string));
    }
    if (recipients.length === 0) recipients.push(listing.user_id);

    const ageMinutes = Math.max(
      0,
      Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60000),
    );

    let escalatedTo: string | null = null;
    for (const uid of recipients) {
      const { data: userRes } = await admin.auth.admin.getUserById(uid);
      const to = userRes?.user?.email?.trim();
      if (!to) continue;
      const sent = await sendEscalationEmail({
        to,
        listingId: listing.id,
        listingName: listing.name || "your listing",
        lead: lead as Pick<Lead, "name" | "phone" | "email" | "created_at">,
        ageMinutes,
      });
      if (sent && !escalatedTo) escalatedTo = uid;
    }
    return { escalatedTo: escalatedTo ?? recipients[0] ?? null };
  } catch (e) {
    console.warn("[notify] notifyEscalation failed:", e);
    return { escalatedTo: null };
  }
}
