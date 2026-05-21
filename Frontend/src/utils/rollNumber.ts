export const generateRollNumber = (
  batchId: number,
  randomLength: number = 7
): string => {
  const coursePrefix = "D";
  const batchNumber = `B${batchId}`;
  const randomNum = generateRandomNumber(randomLength);
  const checksum = calculateChecksum(randomNum);

  return `${coursePrefix}${batchNumber}-${randomNum}-${checksum}`;
};

const generateRandomNumber = (length: number): string => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};

const calculateChecksum = (number: string): number => {
  const sum = number
    .split("")
    .map(Number)
    .reduce((acc, digit, index) => acc + digit * (index + 1), 0);
  return sum % 10;
};
