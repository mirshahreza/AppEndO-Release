module.exports = async function handler(_req, res) {
  return res.json({ success: true, packageId: 'hawiety', dataPolicy: 'etl-not-seed' });
};
