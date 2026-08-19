import { useEffect, useState } from "react";
import { getAllCourse, getCenter } from "../services/api";

/**
 * Centers and courses as the database actually holds them.
 *
 * The admission/earning summary cards used to hardcode their own copies of
 * these lists ("BUITEMS", "AWE", "Creative", ...). Renaming a course in the
 * database left the old label on screen with a count of zero, and any center
 * or course added later was invisible. Every summary now derives its rows from
 * here instead.
 *
 * Both endpoints are small, unchanging and requested by several summary
 * components on the same screen, so the in-flight promise is shared at module
 * scope: the first caller triggers one request and the rest await it. A failed
 * load is not cached, so the next mount retries.
 */

export interface CenterRef {
  center_id: number;
  center_name: string;
  center_status?: number;
}

export interface CourseRef {
  course_id: number;
  course_name: string;
  course_full_name: string;
  course_status?: number;
}

export interface ReferenceData {
  centers: CenterRef[];
  courses: CourseRef[];
  loading: boolean;
  error: string | null;
}

const byName = <T,>(key: keyof T) => (a: T, b: T) =>
  String(a[key] ?? "").localeCompare(String(b[key] ?? ""));

let cache: { centers: CenterRef[]; courses: CourseRef[] } | null = null;
let inFlight: Promise<{ centers: CenterRef[]; courses: CourseRef[] }> | null = null;

const load = () => {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;

  inFlight = Promise.all([
    Promise.resolve(getCenter()).catch(() => []),
    Promise.resolve(getAllCourse()).catch(() => []),
  ])
    .then(([centersRaw, coursesRaw]) => {
      const centers: CenterRef[] = (Array.isArray(centersRaw) ? centersRaw : [])
        .map((center: any) => ({
          center_id: Number(center.center_id),
          center_name: String(center.center_name ?? "").trim(),
          center_status: Number(center.center_status ?? 1),
        }))
        .filter((center: CenterRef) => center.center_name)
        .sort(byName<CenterRef>("center_name"));

      const courses: CourseRef[] = (Array.isArray(coursesRaw) ? coursesRaw : [])
        .map((course: any) => ({
          course_id: Number(course.course_id),
          course_name: String(course.course_name ?? "").trim(),
          course_full_name: String(
            course.course_full_name ?? course.course_name ?? ""
          ).trim(),
          course_status: Number(course.course_status ?? 1),
        }))
        .filter((course: CourseRef) => course.course_name || course.course_full_name)
        .sort(byName<CourseRef>("course_full_name"));

      cache = { centers, courses };
      return cache;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/** Drop the cache so the next mount refetches - call after editing a center or course. */
export const invalidateReferenceData = () => {
  cache = null;
};

export const useReferenceData = (): ReferenceData => {
  const [centers, setCenters] = useState<CenterRef[]>(cache?.centers ?? []);
  const [courses, setCourses] = useState<CourseRef[]>(cache?.courses ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    load()
      .then((data) => {
        if (cancelled) return;
        setCenters(data.centers);
        setCourses(data.courses);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load centers and courses");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { centers, courses, loading, error };
};

/**
 * Merge the names a summary should always show with the keys the statistics
 * actually came back with.
 *
 * Keeping both matters: the reference list makes centers/courses with no
 * applicants appear as a zero rather than vanishing, while the stats keys make
 * sure historic rows still render after a rename (the old name keeps its
 * count instead of being silently dropped).
 */
export const mergeCategories = (
  preferred: string[],
  fromStats: string[]
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of [...preferred, ...fromStats]) {
    const label = String(name ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }

  return result;
};
