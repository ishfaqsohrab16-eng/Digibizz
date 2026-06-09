const fs = require("fs");
const path = require("path");

const settingsPath = path.join(
  __dirname,
  "..",
  "uploads",
  "settings",
  "appSettings.json"
);

const defaultSettings = {
  requireStudentDocuments: true,
};

const normalizeSettings = (settings = {}) => ({
  ...defaultSettings,
  ...settings,
  requireStudentDocuments: settings.requireStudentDocuments !== false,
});

const writeSettings = (settings) => {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
};

const getAppSettings = () => {
  try {
    if (!fs.existsSync(settingsPath)) {
      writeSettings(defaultSettings);
      return { ...defaultSettings };
    }

    const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const normalized = normalizeSettings(parsed);
    writeSettings(normalized);
    return normalized;
  } catch (error) {
    console.error("App settings file error:", error);
    writeSettings(defaultSettings);
    return { ...defaultSettings };
  }
};

const updateAppSettings = (nextSettings) => {
  const updated = normalizeSettings({
    ...getAppSettings(),
    ...nextSettings,
  });
  writeSettings(updated);
  return updated;
};

module.exports = {
  getAppSettings,
  updateAppSettings,
};
