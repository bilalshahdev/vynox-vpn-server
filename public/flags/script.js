const fs = require("fs");
const path = require("path");

const folderPath = __dirname; // current folder
const outputFile = path.join(folderPath, "png-files.txt");

let pngFiles = [];

console.log(`🗂️ Scanning folder: ${folderPath}`);

fs.readdirSync(folderPath).forEach((file) => {
  if (path.extname(file).toLowerCase() === ".png") {
    pngFiles.push(file);
    console.log(`📄 Found PNG: ${file}`);
  }
});

if (pngFiles.length > 0) {
  fs.writeFileSync(outputFile, pngFiles.join("\n"), "utf-8");
  console.log(`✅ Saved ${pngFiles.length} PNG file names to ${outputFile}`);
} else {
  console.log("⚠️ No PNG files found in this folder.");
}
