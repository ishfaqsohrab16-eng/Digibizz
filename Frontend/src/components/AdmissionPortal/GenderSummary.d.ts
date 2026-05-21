export interface GenderStats {
  male: {
    total: number;
    passed: number;
  };
  female: {
    total: number;
    passed: number;
  };
}

export function GenderSummary(props: { genderStats: GenderStats }): JSX.Element;
