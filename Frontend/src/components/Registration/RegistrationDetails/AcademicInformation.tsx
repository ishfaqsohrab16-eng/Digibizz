import React from "react";
import {
  digreeOptions,
  degreeAreas,
  institutions,
} from "../../../types/degreeAreas";
import { Field, SelectInput, fieldGrid } from "./fields";

interface AcademicInformationProps {
  formData: any;
  errors: any;
  handleInputChange: (e: React.ChangeEvent<any>) => void;
}

const AcademicInformation: React.FC<AcademicInformationProps> = ({
  formData,
  errors,
  handleInputChange,
}) => {
  return (
    <div className={fieldGrid}>
      <Field
        label="Degree level"
        htmlFor="cand_degree_level"
        required
        error={errors.cand_degree_level}
      >
        <SelectInput
          id="cand_degree_level"
          name="cand_degree_level"
          value={formData.cand_degree_level}
          onChange={handleInputChange}
          hasError={Boolean(errors.cand_degree_level)}
        >
          <option value="">Please select</option>
          {Array.from(new Set(digreeOptions)).map((degreeOption, index) => (
            <option key={`${degreeOption}-${index}`} value={degreeOption}>
              {degreeOption}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Institute" htmlFor="institute" required error={errors.institute}>
        <SelectInput
          id="institute"
          name="institute"
          value={formData.institute}
          onChange={handleInputChange}
          hasError={Boolean(errors.institute)}
        >
          <option value="">Please select</option>
          {Array.from(new Set(institutions)).map((institute, index) => (
            <option key={`${institute}-${index}`} value={institute}>
              {institute}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Degree area" htmlFor="degree_area" required error={errors.degree_area}>
        <SelectInput
          id="degree_area"
          name="degree_area"
          value={formData.degree_area}
          onChange={handleInputChange}
          hasError={Boolean(errors.degree_area)}
        >
          <option value="">Please select</option>
          {Array.from(new Set(degreeAreas)).map((degree_area, index) => (
            <option key={`${degree_area}-${index}`} value={degree_area}>
              {degree_area}
            </option>
          ))}
        </SelectInput>
      </Field>

    </div>
  );
};

export default AcademicInformation;
