const write = (level, message, meta) => {
  const line = { time: new Date().toISOString(), level, message, ...meta };
  const output = level === "error" ? console.error : console.log;
  output(JSON.stringify(line));
};

module.exports = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};
