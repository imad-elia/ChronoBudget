// Pins the timezone for a whole Jest run, so the CI matrix can exercise the
// date-bucketing SQL in more than one zone.
//
// Why CB_TZ and not TZ: on Windows under Git Bash, MSYS intercepts and mangles
// TZ, so neither `TZ=... npx jest` nor `export TZ=...` reaches node.exe. CB_TZ
// passes through untouched on every platform, and assigning process.env.TZ
// here — before Jest forks its workers, which inherit process.env — applies it
// to every test file.
//
// sql.js resolves SQLite's 'localtime' modifier through Emscripten, which
// derives its offset from JS Date, so this reaches the SQL layer too. That is
// what makes the localtime-vs-UTC bucketing assertions meaningful; in UTC they
// pass trivially, because the two are identical by definition.
module.exports = () => {
  if (process.env.CB_TZ) {
    process.env.TZ = process.env.CB_TZ;
  }
};
