import React, { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { resetStudentPasswordByAdmin } from "../../services/api";

/**
 * A student's password, for the Super Admin.
 *
 * WHAT CAN BE SEEN IS WHETHER ONE IS SET, NOT WHAT IT IS. Passwords are stored
 * as a one-way hash, so nothing here - and nothing that could be added here -
 * can read one back. That is the point of storing them that way, and it is
 * worth saying on the screen rather than leaving somebody hunting for a reveal
 * button that cannot exist.
 *
 * Which leaves the fact that actually answers the question people arrive with.
 * "The student cannot log in" is almost always one of two situations, and they
 * need opposite replies:
 *
 *   NO PASSWORD SET - they have never completed signup. Nothing is broken;
 *   they can still do it themselves with their CNIC.
 *
 *   PASSWORD SET - they have one and it is not working for them. Setting a new
 *   one here is the fix, and telling them the new password is the handover.
 *
 * Setting a password is Super Admin only, on the server as well as here: it is
 * the strongest thing one account can do to another, and a control that is
 * merely hidden is not a restriction.
 */

interface StudentPasswordProps {
  userId: number;
  name: string;
  email: string;
  /** Whether a password exists. Undefined where the caller could not say. */
  accountSetup?: boolean;
  /** Called after a successful change, to refresh whatever is on screen. */
  onChanged?: () => void;
}

const StudentPassword: React.FC<StudentPasswordProps> = ({
  userId,
  name,
  email,
  accountSetup,
  onChanged,
}) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const close = () => {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setShow(false);
  };

  const submit = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const response = await resetStudentPasswordByAdmin(userId, password);

      if (response.success) {
        // Named on purpose: whoever did this has to pass it on, and a bare
        // "saved" leaves them looking for what to tell the student.
        toast.success(`Password set for ${name}. Give it to them to sign in with.`);
        close();
        onChanged?.();
      } else {
        toast.error(response.message || "Could not set the password");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set the password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-[hsl(var(--foreground))]">
            <KeyRound className="h-4 w-4" />
            Password
          </h3>

          {accountSetup === undefined ? (
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Set a new password for {name} ({email}).
            </p>
          ) : accountSetup ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
              This student has set a password. It is stored one-way and cannot be read
              back — if they have lost it, set a new one.
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
              <ShieldAlert className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
              No password yet — this student has never completed signup. They can still
              do it themselves with their CNIC, or you can set one for them here.
            </p>
          )}
        </div>

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-md bg-[hsl(var(--warning))] px-4 py-2 text-[hsl(var(--warning-foreground))] transition-colors hover:bg-[hsl(var(--accent))]"
          >
            <KeyRound className="h-4 w-4" />
            {accountSetup === false ? "Set Password" : "Reset Password"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
                New Password
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 pr-10 text-[hsl(var(--foreground))]"
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShow((current) => !current)}
                  // Typing a password nobody can read back, to hand to somebody
                  // else, is worth being able to check before saving.
                  title={show ? "Hide" : "Show what you typed"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[hsl(var(--muted-foreground))]"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
                Confirm Password
              </label>
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-[hsl(var(--foreground))]"
                placeholder="Type it again"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            The student is not told automatically — pass the new password on yourself.
          </p>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !password || !confirm}
              className="flex items-center gap-2 rounded-md bg-[hsl(var(--teal))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {saving ? "Saving…" : "Save Password"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPassword;
