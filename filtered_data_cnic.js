const xlsx = require('xlsx');
const fs = require('fs');

// Load Excel file
const workbook = xlsx.readFile('data.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonData = xlsx.utils.sheet_to_json(sheet);

// Load list of CNICs
const cnicList = fs.readFileSync('cnic_list.txt', 'utf-8')
  .split('\n')
  .map(cnic => cnic.trim());

// Use a Set to avoid duplicates
const seenCNICs = new Set();
const filteredData = [];

for (const row of jsonData) {
  const cnic = row.CNIC?.trim();
  if (cnic && cnicList.includes(cnic) && !seenCNICs.has(cnic)) {
    filteredData.push(row);
    seenCNICs.add(cnic);
  }
}

// Save the filtered data to a new Excel file
const newWorkbook = xlsx.utils.book_new();
const newSheet = xlsx.utils.json_to_sheet(filteredData);
xlsx.utils.book_append_sheet(newWorkbook, newSheet, 'Filtered');
xlsx.writeFile(newWorkbook, 'filtered_data.xlsx');

console.log('Filtered data saved to filtered_data.xlsx');
