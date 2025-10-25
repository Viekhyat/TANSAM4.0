const fs = require("fs");
const path = "src/pages/Data.jsx";
let text = fs.readFileSync(path, "utf8");
const start = text.indexOf("                  return (");
const end = text.indexOf("                ))}", start);
if (start === -1 || end === -1) {
  throw new Error("target block not found");
}
const oldBlock = text.slice(start, end + "                ))}".length);
const newBlock = `TEST`;
text = text.replace(oldBlock, newBlock);
fs.writeFileSync(path, text, "utf8");
