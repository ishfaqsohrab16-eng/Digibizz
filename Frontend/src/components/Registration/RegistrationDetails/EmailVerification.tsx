import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import {
  confirmEmailVerificationCode,
  getEmailVerificationStatus,
  sendEmailVerificationCode,
} from "../../../services/api";

interface Props {
  email: string;
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
}

const CODE_LENGTH = 6;

const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

/**
 * Confirms the applicant owns the address they typed, on the form itself.
 *
 * The interview call-up is sent to this address, so a typo means the applicant
 * never hears from the program and their seat goes unused. Catching it here is
 * the only moment it can still be corrected.
 *
 * "Send code" only enables once the address is well-formed - offering it on an
 * obviously incomplete address just produces a bounce and a confused applicant.
 * Editing a confirmed address clears the confirmation, since the new one has
 * not been proven.
 */
const EmailVerification: React.FC<Props> = ({
  email,
  verified,
  onVerifiedChange,
}) => {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = String(email || "").trim();
  const valid = looksLikeEmail(trimmed);

  // Re-checked on mount and whenever the address changes, so a confirmed
  // address survives a page refresh or a step back through the form.
  const lastChecked = useRef<string>("");
  useEffect(() => {
    if (!valid || trimmed === lastChecked.current) return;
    lastChecked.current = trimmed;

    let cancelled = false;
    getEmailVerificationStatus(trimmed)
      .then((result) => {
        if (!cancelled) onVerifiedChange(Boolean(result.verified));
      })
      .catch(() => {
        // Not fatal - the applicant can still request a code.
      });

    return () => {
      cancelled = true;
    };
  }, [trimmed, valid, onVerifiedChange]);

  // Changing the address invalidates any confirmation of the previous one.
  const previousEmail = useRef(trimmed);
  useEffect(() => {
    if (previousEmail.current !== trimmed) {
      previousEmail.current = trimmed;
      setSent(false);
      setCode("");
      setMessage(null);
      setError(null);
      if (verified) onVerifiedChange(false);
    }
  }, [trimmed, verified, onVerifiedChange]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await sendEmailVerificationCode(trimmed);
      setSent(true);
      setMessage(result.message);
      setCooldown(result.resendAfterSeconds || 60);
    } catch (err: any) {
      setError(errorMessage(err, "Could not send the code. Please try again."));
      // The server tells us how long to wait after a rate limit.
      const retry = Number(err?.response?.data?.retryAfter);
      if (Number.isFinite(retry) && retry > 0) setCooldown(retry);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await confirmEmailVerificationCode(trimmed, code.trim());
      if (result.verified) {
        onVerifiedChange(true);
        setMessage(result.message || "Email address confirmed");
      } else {
        setError(result.message || "That code is not correct");
      }
    } catch (err: any) {
      setError(errorMessage(err, "Could not check the code"));
    } finally {
      setChecking(false);
    }
  };

  if (verified) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          <strong>{trimmed}</strong> is confirmed.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" />
        <p className="flex-1 text-xs text-slate-600">
          Confirm this address before continuing — your interview details are
          sent here.
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={!valid || sending || cooldown > 0}
          title={
            !valid ? "Enter a complete email address first" : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          {cooldown > 0
            ? `Resend in ${cooldown}s`
            : sent
            ? "Resend code"
            : "Send code"}
        </button>
      </div>

      {sent && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
            }
            placeholder={"0".repeat(CODE_LENGTH)}
            className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-center font-mono text-sm tracking-widest outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={code.length !== CODE_LENGTH || checking}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      )}

      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
};

export default EmailVerification;
