// Endpoint para Data Subject Request (LGPD Art. 18)
app.post('/v1/compliance/dsr', async (req, res) => {
  const { userId, action } = req.body; // export | delete | restrict
  const consent = await consentRegistry.get(userId);
  if (!consent?.isActive()) return res.status(403).json({ error: 'Consent inactive' });

  if (action === 'delete') {
    await cryptoWipe(userId); // Zero-knowledge deletion + proof
    await auditLog('DSR_DELETE', userId, { compliant: true });
  }
  res.json({ status: 'processed', traceId: uuidv4() });
});
