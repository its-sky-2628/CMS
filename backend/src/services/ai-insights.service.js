import { GoogleGenAI } from '@google/genai';
import { db } from '../config/supabase.js';

const ALLOWED_STATUSES = ['PENDING', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'];
const ALLOWED_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export async function generateAIInsights() {
  const { data, error, count } = await db()
    .from('complaints')
    .select('category, priority, status, created_at, sla_due_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    const err = new Error('Could not retrieve complaint statistics');
    err.statusCode = 500;
    throw err;
  }

  const complaints = data || [];

  const countBy = (items, key, allowedValues = null) => {
    const result = {};
    for (const item of items) {
      const value = String(item[key] || 'UNKNOWN').toUpperCase();
      if (!allowedValues || allowedValues.includes(value)) {
        result[value] = (result[value] || 0) + 1;
      }
    }
    return result;
  };

  const now = Date.now();
  const overdue = complaints.filter((c) =>
    c.sla_due_at &&
    new Date(c.sla_due_at).getTime() < now &&
    !['RESOLVED', 'CLOSED'].includes(String(c.status || '').toUpperCase())
  ).length;

  const statistics = {
    totalComplaints: count ?? complaints.length,
    analyzedComplaints: complaints.length,
    categoryBreakdown: countBy(complaints, 'category'),
    statusBreakdown: countBy(complaints, 'status', ALLOWED_STATUSES),
    priorityBreakdown: countBy(complaints, 'priority', ALLOWED_PRIORITIES),
    overdueComplaintsInAnalyzedRecords: overdue,
    note: 'Statistics are based on at most the 500 most recently created records.',
  };

  if (complaints.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      ...statistics,
      executiveSummary: 'There are no complaint records to analyze yet. Insights will become available when complaints are added.',
      insights: [],
      dataAvailable: false,
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('Gemini is not configured. Check GEMINI_API_KEY in backend/.env.');
    err.statusCode = 503;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
You are an analytics assistant for a complaint management system.
Analyze the following aggregate statistics. Do not invent facts, causes,
trends, or comparisons that cannot be supported by the provided data.
The dataset may contain only the latest 500 records, so acknowledge this limitation.
Do not make decisions about individual people.

Return ONLY valid JSON with this exact shape:
{
  "executiveSummary": "Short summary grounded in the statistics",
  "insights": [
    {
      "title": "Short title",
      "severity": "LOW, MEDIUM, or HIGH",
      "evidence": "Specific supporting counts or percentages",
      "recommendation": "Practical next step"
    }
  ]
}
Return at most 5 insights. If the data does not support a conclusion,
say so instead of guessing.

Statistics:
${JSON.stringify(statistics)}
`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  let result;
  try {
    result = JSON.parse(response.text);
  } catch {
    const err = new Error('Gemini returned an unexpected response. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  const insights = Array.isArray(result.insights)
    ? result.insights.slice(0, 5).map((item) => ({
        title: String(item.title || 'Insight').slice(0, 160),
        severity: ['LOW', 'MEDIUM', 'HIGH'].includes(item.severity)
          ? item.severity
          : 'LOW',
        evidence: String(item.evidence || '').slice(0, 500),
        recommendation: String(item.recommendation || '').slice(0, 500),
      }))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    ...statistics,
    executiveSummary: String(result.executiveSummary || 'Analysis completed.').slice(0, 1500),
    insights,
    dataAvailable: true,
  };
}
