const fs = require("fs");
const path = require("path");

const dir = "./locales";

for (const file of fs.readdirSync(dir)) {
  if (file.endsWith(".json")) {
    const full = path.join(dir, file);
    let data = fs.readFileSync(full);

    // Remove BOM if exists
    if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
      console.log("Removing BOM from:", file);
      data = data.slice(3);
      fs.writeFileSync(full, data);
    } else {
      console.log("No BOM in:", file);
    }
  }
}

console.log("Done.");
