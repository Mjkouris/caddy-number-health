export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const IPQS_KEY = process.env.IPQS_API_KEY;
  try {
    const response = await fetch(
      `https://ipqualityscore.com/api/json/phone/${IPQS_KEY}/${encodeURIComponent(phone)}?country[]=US&strictness=1`
    );
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach IPQS', details: err.message });
  }
}
