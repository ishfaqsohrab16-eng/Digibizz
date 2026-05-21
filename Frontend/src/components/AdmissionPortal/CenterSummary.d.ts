export interface CourseStats {
  total: number;
  male: number;
  female: number;
}

export interface CenterStats {
  [center: string]: {
    total: number;
    male: number;
    female: number;
    courses: {
      [course: string]: CourseStats;
    };
  };
}

export function CenterSummary(props: { centerStats: CenterStats }): JSX.Element;
