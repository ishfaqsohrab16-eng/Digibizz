import { useEffect, useState } from "react";

/**
 * Somebody's photograph, or a stand-in when there is not one.
 *
 * A missing photograph used to render as `${BACKEND_URL}undefined` - a broken
 * image icon and the alt text next to it, repeated down the whole column. That
 * reads as "this system is broken", when the truth is only "we do not have a
 * picture of this person", and those deserve to look different.
 *
 * TWO WAYS IT CAN GO WRONG, and both land here. The column may be empty, which
 * is known before rendering; or it may hold a path whose file is no longer on
 * the disk, which is only discovered when the browser fails to load it. The
 * second is handled by onError, because nothing else can see it.
 *
 * THE STAND-IN FOLLOWS THE PERSON'S GENDER where the record knows it. A single
 * neutral silhouette for everybody is the safe choice and also a duller one -
 * a list of trainees reads more like a list of people when the placeholders
 * are not all identical. Where gender is not recorded, the neutral one is used
 * rather than a guess.
 */

type Gender = "male" | "female" | "unknown";

const normaliseGender = (value?: string | null): Gender => {
  const clean = String(value ?? "").trim().toLowerCase();
  if (clean.startsWith("m")) return "male";
  if (clean.startsWith("f")) return "female";
  return "unknown";
};

/**
 * The silhouettes.
 *
 * Drawn rather than loaded, so they cost no request, never 404, scale to any
 * size and take their colour from the theme in both light and dark.
 */
const Silhouette = ({ gender }: { gender: Gender }) => (
  <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
    {gender === "female" && (
      // Hair framing the face, drawn behind the head.
      <path
        d="M10 19c0-7 4-11 10-11s10 4 10 11c0 3-1 5-1 5l-2-1c1-2 1-9-7-9s-8 7-7 9l-2 1s-1-2-1-5z"
        fill="currentColor"
        opacity="0.55"
      />
    )}
    {gender === "male" && (
      // A short, squared hairline.
      <path
        d="M12 16c0-5 3.5-8 8-8s8 3 8 8l-2 1c0-4-2.5-6-6-6s-6 2-6 6z"
        fill="currentColor"
        opacity="0.55"
      />
    )}
    <circle cx="20" cy="16" r="6.5" fill="currentColor" opacity="0.85" />
    <path
      d="M8 34c0-6.2 5.4-10 12-10s12 3.8 12 10z"
      fill="currentColor"
      opacity="0.85"
    />
  </svg>
);

const TONE: Record<Gender, string> = {
  // From the existing palette rather than the usual blue/pink, so the table
  // still looks like the rest of the product.
  male: "bg-[hsl(var(--navy-light))] text-[hsl(var(--navy))]",
  female: "bg-[hsl(var(--pink-light))] text-[hsl(var(--pink))]",
  unknown: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

interface PersonAvatarProps {
  /** The stored path, e.g. "/uploads/user-profiles/x.jpg". May be absent. */
  src?: string | null;
  /** Prefixed to a stored path to make it loadable. */
  baseUrl?: string;
  /** Whose picture this is, for the alt text and the initials fallback. */
  name?: string | null;
  gender?: string | null;
  /** Tailwind size classes. */
  className?: string;
}

export function PersonAvatar({
  src,
  baseUrl = "",
  name,
  gender,
  className = "h-11 w-11",
}: PersonAvatarProps) {
  const [failed, setFailed] = useState(false);

  // A new row can reuse this component instance, and a previous row's failure
  // must not blank out the next person's perfectly good photograph.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const person = normaliseGender(gender);
  const label = String(name ?? "").trim();
  const path = String(src ?? "").trim();
  const usable = path && path !== "null" && path !== "undefined" && !failed;

  const shell = `relative shrink-0 overflow-hidden rounded-full ring-1 ring-[hsl(var(--border))] ${className}`;

  if (!usable) {
    return (
      <div
        className={`${shell} ${TONE[person]} flex items-center justify-center`}
        title={label ? `No photo of ${label}` : "No photo"}
        role="img"
        aria-label={label ? `No photo of ${label}` : "No photo"}
      >
        <Silhouette gender={person} />
      </div>
    );
  }

  return (
    <div className={`${shell} bg-[hsl(var(--muted))]`}>
      <img
        src={`${baseUrl}${path}`}
        alt={label ? `${label}` : "Photo"}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

export default PersonAvatar;
