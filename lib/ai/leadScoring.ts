
import OpenAI from 'openai'

const createOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

export async function analyzeLead(data: any) {
  const openai = createOpenAIClient()
  const prompt = `Analysiere diese Anfrage JSON: ${JSON.stringify(data)}. Antworte mit JSON: {"summary": "...", "score": "gold|silver|low_quality", "tags": []}`
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })
  return JSON.parse(completion.choices[0].message.content || '{}')
}
