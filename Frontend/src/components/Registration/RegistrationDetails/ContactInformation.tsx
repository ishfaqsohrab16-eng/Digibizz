import React from "react";
import { CandidateFormData } from "../../../types/registration";
import { domicileOptions } from "../../../types/degreeAreas";
import { Field, SelectInput, TextInput, TextareaInput, fieldGrid } from "./fields";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ContactFieldState } from "./RegistrationDetails";

interface ContactInformationProps {
  formData: CandidateFormData;
  errors: { [key: string]: string };
  handleInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => void;
  /** Whether the server has said this value is free, as it is typed. */
  emailState?: ContactFieldState;
  phoneState?: ContactFieldState;
}

/**
 * The line under the field while it is being checked.
 *
 * Nothing is shown for "unknown" or "taken": there is no news before the
 * first answer, and a taken value is already reported as a field error in
 * red - saying it twice, in two styles, reads as two problems.
 */
const ContactStatus: React.FC<{ state?: ContactFieldState; noun: string }> = ({
  state,
  noun,
}) => {
  if (state === "checking") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking this {noun}…
      </p>
    );
  }
  if (state === "free") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        This {noun} is available
      </p>
    );
  }
  return null;
};

const ContactInformation: React.FC<ContactInformationProps> = ({
  formData,
  errors,
  handleInputChange,
  emailState,
  phoneState,
}) => {
  return (
    <div className={fieldGrid}>
      <Field label="Email address" htmlFor="cand_email" required error={errors.cand_email}>
        <TextInput
          type="email"
          id="cand_email"
          name="cand_email"
          value={formData.cand_email}
          onChange={handleInputChange}
          placeholder="Enter your email address"
          hasError={Boolean(errors.cand_email) || emailState === "taken"}
        />
        <ContactStatus state={emailState} noun="email address" />
      </Field>

      <Field label="Phone no." htmlFor="cand_phone" required error={errors.cand_phone}>
        <TextInput
          type="tel"
          id="cand_phone"
          name="cand_phone"
          value={formData.cand_phone}
          onChange={handleInputChange}
          placeholder="Enter your phone number"
          hasError={Boolean(errors.cand_phone) || phoneState === "taken"}
        />
        <ContactStatus state={phoneState} noun="phone number" />
      </Field>

      <Field
        label="WhatsApp no."
        htmlFor="cand_whatsapp"
        required
        error={errors.cand_whatsapp}
        hint="Used for future communication and alerts."
      >
        <TextInput
          type="tel"
          id="cand_whatsapp"
          name="cand_whatsapp"
          value={formData.cand_whatsapp}
          onChange={handleInputChange}
          placeholder="Enter your WhatsApp number"
          hasError={Boolean(errors.cand_whatsapp)}
        />
      </Field>

      <Field
        label="Current address"
        htmlFor="current_address"
        required
        error={errors.current_address}
      >
        <TextareaInput
          id="current_address"
          name="current_address"
          value={formData.current_address}
          onChange={handleInputChange}
          placeholder="Enter your current address"
          hasError={Boolean(errors.current_address)}
        />
      </Field>

      <Field
        label="Current city"
        htmlFor="current_city"
        required
        error={errors.current_city}
      >
        <SelectInput
          id="current_city"
          name="current_city"
          value={formData.current_city}
          onChange={handleInputChange}
          hasError={Boolean(errors.current_city)}
        >
          <option value="">Please select</option>
          {domicileOptions.map((domicileOption) => (
            <option key={domicileOption} value={domicileOption}>
              {domicileOption}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field
        label="Where did you find us"
        htmlFor="where_find_us"
        required
        error={errors.where_find_us}
      >
        <SelectInput
          id="where_find_us"
          name="where_find_us"
          value={formData.where_find_us}
          onChange={handleInputChange}
          hasError={Boolean(errors.where_find_us)}
        >
          <option value="">Please select</option>
          <option value="Facebook">Facebook</option>
          <option value="Instagram">Instagram</option>
          <option value="Friend">Friend</option>
          <option value="Other">Other</option>
        </SelectInput>
      </Field>
    </div>
  );
};

export default ContactInformation;
