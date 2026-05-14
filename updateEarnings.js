const fs = require("fs");

// Function to read SQL file and return the content
function readSQLFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

// Function to parse SQL insert statements into an array of objects
function parseInsertStatements(sql) {
  const insertStatements = sql.match(
    /INSERT INTO `\w+` \(([^)]+)\) VALUES\s+(.*);/s
  );
  if (!insertStatements) return [];

  const columnsPart = insertStatements[1];
  const valuesPart = insertStatements[2];

  const columns = columnsPart
    .split(",")
    .map((col) => col.trim().replace(/`/g, ""));
  const values = valuesPart
    .split("),")
    .map((val) => val.trim().replace(/^\(|\);?$/g, ""));

  return values.map((value) => {
    const valueArray = value
      .split(",")
      .map((val) => val.trim().replace(/^'|'$/g, ""));
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = valueArray[index];
    });
    return obj;
  });
}

// Function to generate SQL insert statements from an array of objects
function generateInsertStatements(tableName, data) {
  if (data.length === 0) return "";

  const columns = Object.keys(data[0]);
  const values = data.map(
    (row) =>
      `(${columns
        .map((col) =>
          typeof row[col] === "number" ? row[col] : `'${row[col]}'`
        )
        .join(", ")})`
  );

  return `INSERT INTO \`${tableName}\` (${columns
    .map((col) => `\`${col}\``)
    .join(", ")}) VALUES\n${values.join(",\n")});`;
}

// Main function to update the earnings table
function updateEarnings() {
  // Read the SQL files
  const studentsSQL = readSQLFile("students.sql");
  const earningsSQL = readSQLFile("earnings.sql");

  // Parse the insert statements into arrays of objects
  const students = parseInsertStatements(studentsSQL);
  const earnings = parseInsertStatements(earningsSQL);

  // Create a map of std_rollno to std_id from students table
  const studentMap = new Map();
  students.forEach((student) => {
    studentMap.set(student.std_rollno, parseInt(student.std_id, 10));
  });

  // Update the earnings table with std_id from students table and rename the column
  const updatedEarnings = earnings.map((earning) => {
    const std_id = studentMap.get(earning.std_rollno);
    if (std_id) {
      // Replace the std_rollno column with std_id while maintaining the position
      const updatedEarning = { ...earning, std_id };
      delete updatedEarning.std_rollno;
      const orderedEarning = {};
      Object.keys(earning).forEach((key) => {
        if (key === "std_rollno") {
          orderedEarning["std_id"] = std_id;
        } else {
          orderedEarning[key] = updatedEarning[key];
        }
      });
      return orderedEarning;
    }
    return earning;
  });

  // Generate the updated SQL insert statements
  const updatedEarningsSQL = generateInsertStatements(
    "earnings",
    updatedEarnings
  );

  // Write the updated SQL to a new file
  fs.writeFileSync("updated_earnings.sql", updatedEarningsSQL);

}

updateEarnings();
