const xlsx = require("xlsx");
const fs = require("fs");

// Load Excel file
const workbook = xlsx.readFile("studentdata.xlsx");
const filter = xlsx.readFile("studentdata.xlsx");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const filterSheet = filter.Sheets[filter.SheetNames[0]];
const jsonData = xlsx.utils.sheet_to_json(sheet, { defval: "" });
const filterData = xlsx.utils.sheet_to_json(filterSheet, { defval: "" });
// console.log(jsonData);
// Starting IDs
let userId = 4850;
let stdId = 5050;

// Current timestamp
const now = new Date().toISOString().slice(0, 19).replace("T", " ");
// user table
// user_id Primary	int(11)			No	None		AUTO_INCREMENT	Change Change	Drop Drop	
// 	2	user_name	varchar(50)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	3	user_username Index	varchar(100)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	4	user_email Index	varchar(100)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	5	user_password	varchar(255)	latin1_swedish_ci		Yes	NULL			Change Change	Drop Drop	
// 	6	user_profile_photo	varchar(255)	latin1_swedish_ci		Yes	NULL			Change Change	Drop Drop	
// 	7	user_type	varchar(50)	latin1_swedish_ci		No	Contentuser			Change Change	Drop Drop	
// 	8	user_status	int(11)			Yes	1			Change Change	Drop Drop	
// 	9	createdAt	datetime			No	None			Change Change	Drop Drop	
// 	10	updatedAt
// student table
// 1	std_id Primary	int(11)			No	None		AUTO_INCREMENT	Change Change	Drop Drop	
// 	2	user_id Index	int(11)			No	6			Change Change	Drop Drop	
// 	3	std_rollno	varchar(50)	latin1_swedish_ci		No				Change Change	Drop Drop	
// 	4	std_cnic Index	varchar(50)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	5	std_fathername	varchar(100)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	6	std_gender	varchar(50)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	7	std_qualification	varchar(100)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	8	std_district	varchar(100)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	9	std_phone	varchar(20)	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	10	tb_id Index	int(11)			No	6			Change Change	Drop Drop	
// 	11	course_id Index	int(11)			No	None			Change Change	Drop Drop	
// 	12	center_id Index	int(11)			No	None			Change Change	Drop Drop	
// 	13	dark_mode	int(11)			No	0			Change Change	Drop Drop	
// 	14	std_added_on	datetime			No	None			Change Change	Drop Drop	
// 	15	std_lms_status	int(11)			No	0			Change Change	Drop Drop	
// 	16	std_forum_status	int(11)			No	0			Change Change	Drop Drop	
// 	17	suspension_reason	text	latin1_swedish_ci		No	None			Change Change	Drop Drop	
// 	18	special_case	varchar(50)	latin1_swedish_ci		No	1			Change Change	Drop Drop	
// 	19	special_case_comments	varchar(100)	latin1_swedish_ci		No				Change Change	Drop Drop	
// 	20	createdAt	datetime			No	None			Change Change	Drop Drop	
// 	21	updatedAt	datetime			No	None			Change Change	Drop Drop	
const generateRollNumber = (
  batchId,
  randomLength = 7
) => {
  const coursePrefix = "D";
  const batchNumber = `B${batchId}`;
  const randomNum = generateRandomNumber(randomLength);
  const checksum = calculateChecksum(randomNum);

  return `${coursePrefix}${batchNumber}-${randomNum}-${checksum}`;
};

const generateRandomNumber = (length) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};

const calculateChecksum = (number) => {
  const sum = number
    .split("")
    .map(Number)
    .reduce((acc, digit, index) => acc + digit * (index + 1), 0);
  return sum % 10;
};

// Output SQL strings
let userSql = `-- INSERT INTO user (user_id, user_name, user_username, user_email, user_password, user_profile_photo, user_type, user_status, createdAt, updatedAt)\nINSERT INTO user VALUES\n`;
let studentSql = `-- INSERT INTO students (std_id, user_id, std_rollno, std_cnic, std_fathername, std_gender, std_qualification, std_district, std_phone, tb_id, course_id, center_id, dark_mode, std_added_on, std_lms_status, std_forum_status, suspension_reason, special_case, special_case_comments, createdAt, updatedAt)\nINSERT INTO students VALUES\n`;

const getCourseId = (courseName) => {
  switch (courseName.toLowerCase().trim()) {
    case "digital":
      return 1;
    case "awe":
      return 2;
    case "creative":
      return 3;
    case "Technical":
      return 4;
    default:
      return null;
  }
};
const getCenterId = (centerName) => {
  switch (centerName) {
    case "GCC":
      return 1;
    case "ITTI Pishin Stop QTA":
      return 2;
    case "BUITEMS":
      return 3;
    case "UoL":
      return 5;
    case "MCKRU":
      return 6;
    case "UoG":
      return 7;
    case "ITTI Zhob":
      return 8;
    case "UoB":
      return 4;
    default:
      return null;
  }
};

const seenCnic = new Set();
const validEntries = [];

// Create a Set of filter CNICs for O(1) lookup
const filterCnics = new Set(filterData.map(row => row.CNIC));

// Filter jsonData based on CNICs in filterData, avoiding duplicates
jsonData.forEach((row) => {
  const cnic = row.CNIC;
  if (filterCnics.has(cnic) && !seenCnic.has(cnic)) {
    seenCnic.add(cnic);
    validEntries.push(row);
  }
});

validEntries.forEach((row) => {
  //XL file columns
  //  CNIC: '51201-5952246-2',
  // Image: '/uploads/candidate_photos/cand_photo-1754903403166-287255515.jfif',
  // Name: 'Bibi Gu',
  // "Father's Name": 'Muhammad Qasim ',
  // Gender: 'female',
  // Course: 'Creative',
  // Center: 'ITTI Pishin Stop QTA',
  // Phone: '0316-8586297 ',
  // WhatsApp: '0316-8586297 ',
  // Email: 'bibigulmengal297@gmail.com',
  // Domicile: 'Kallat',
  // Qualification: 'B.Tech (3 Years)'
  console.log(row);
  const cnic = String(row["CNIC"]).trim();
  const image = row["Image"].trim();
  const name = row["Name"].trim();
  const fatherName = row["Father's Name"].trim();
  const gender = row["Gender"].trim();
  const course = row["Course"].trim();
  const center = row["Center"].trim();
  const phone = String(row["Phone"]).trim();
  // const whatsapp = row["WhatsApp"].trim();
  const email = row["Email"].trim().toLowerCase();
  // const domicile = row["Domicile"].trim();
  // const qualification = row["Qualification"].trim();
  const courseId = getCourseId(course);
  const centerId = getCenterId(center);
  if(email === "zk5293032@gmail.com"){
    return;
  }
  // // User insert
  userSql += `(${userId}, '${name}', '${email}', '${email}','', '${image}', 'student', 1, NOW(), NOW()),\n`;
  // // student insert
  studentSql += `(${stdId},${userId}, '${generateRollNumber(8)}', '${cnic}', '${fatherName}', '${gender}', '1', '24', '${phone}',9,${courseId},2,0, NOW(),0,0,'',0, '', NOW(), NOW() ),\n`;
  userId++;
  stdId++;
});

// // Remove trailing comma and add semicolon
userSql = userSql.trim().replace(/,$/, ";");
studentSql = studentSql.trim().replace(/,$/, ";");

// // Write to file
fs.writeFileSync("insert_data.sql", userSql, "utf8");
fs.writeFileSync("student_insert_data.sql", studentSql, "utf8");
console.log(
  `SQL file generated successfully for ${validEntries.length} entries.`
);
