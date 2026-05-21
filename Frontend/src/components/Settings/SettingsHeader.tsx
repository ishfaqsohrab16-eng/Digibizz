import { FC } from "react";
interface SettingsHeaderProps {
  SettingsHeader: string;
  SettingDescription: string;
}
const SettingsHeader: FC<SettingsHeaderProps> = ({
  SettingsHeader,
  SettingDescription,
}) => {
  return (
    <div className="header-gradient text-white p-6 rounded-md mb-8">
      <h1 className="text-2xl mb-2">{SettingsHeader}</h1>
      <p>{SettingDescription}</p>
    </div>
  );
};

export default SettingsHeader;
