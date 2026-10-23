import { generateAIInsights } from '../services/ai-insights.service.js';

export async function getInsights(req, res) {
  const insights = await generateAIInsights();

  return res.json({
    success: true,
    message: 'AI insights generated successfully',
    data: { insights },
  });
}
