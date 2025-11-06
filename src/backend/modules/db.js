const sqlite3 = require('sqlite3').verbose();

function connect(filepath = ':memory:') {
  return new sqlite3.Database(filepath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
}
function getTables(db, cb) {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", cb);
}
function getTableData(db, table, cb) {
  db.all(`SELECT * FROM ${table}`, cb);
}
module.exports = { connect, getTables, getTableData };
