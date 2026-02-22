const { clearCookie } = require("./_auth");

module.exports = async function handler(req, res) {
  clearCookie(res);
  return res.status(200).json({ ok:true });
};
