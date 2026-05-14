const fs = require("fs");
const path = require("path");

// Function to read SQL files and parse the data into arrays of records
function readSQLFile(filePath) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const records = fileContent
    .split("\n")
    .filter((line) => line.trim().startsWith("INSERT INTO"))
    .map((line) => {
      const match = line.match(/\(([^)]+)\)/);
      const values = match
        ? match[1].split(",").map((value) => value.trim().replace(/['"]+/g, ""))
        : [];
      return { cnic: values[0], record: line.trim() };
    });
  return records;
}

// Function to get the missing records from two tables based on std_cnic
function getMissingRecords(records1, records2) {
  const map1 = new Map(records1.map((record) => [record.cnic, record.record]));
  const map2 = new Map(records2.map((record) => [record.cnic, record.record]));

  const missingInTable1 = records2
    .filter((record) => !map1.has(record.cnic))
    .map((record) => record.record);
  const missingInTable2 = records1
    .filter((record) => !map2.has(record.cnic))
    .map((record) => record.record);

  return { missingInTable1, missingInTable2 };
}

// Function to write missing records to separate files
function writeMissingRecords(filePath, records) {
  const content = records.join("\n");
  fs.writeFileSync(filePath, content, "utf8");
}

// Main function to compare student tables and write missing records
function compareStudentTables(file1, file2) {
  const filePath1 = path.resolve(__dirname, file1);
  const filePath2 = path.resolve(__dirname, file2);

  const records1 = readSQLFile(filePath1);
  const records2 = readSQLFile(filePath2);

  const { missingInTable1, missingInTable2 } = getMissingRecords(
    records1,
    records2
  );

  writeMissingRecords("missing_records_table1.sql", missingInTable1);
  writeMissingRecords("missing_records_table2.sql", missingInTable2);

  console.log(
    "Missing records written to missing_records_table1.sql and missing_records_table2.sql"
  );
}

// Example usage
compareStudentTables("studenttable1.sql", "studenttable2.sql");
