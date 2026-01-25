/**
 * Gemini API検証スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-gemini.ts <API_KEY>
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '種目名' },
          sets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                weight: { type: 'number', description: '重量（kg）。自重の場合は0' },
                reps: { type: 'number', description: '回数' },
              },
              required: ['weight', 'reps'],
            },
          },
        },
        required: ['name', 'sets'],
      },
    },
    advice: { type: 'string', description: '今日のトレーニングに関するアドバイス' },
  },
  required: ['exercises'],
}

const testPrompt = `あなたは経験豊富なパーソナルトレーナーです。
ユーザーの情報と過去のトレーニング履歴を考慮し、今日のトレーニングプランを提案してください。

【重要な指示】
1. 提案する種目は「利用可能な器具」リストに存在するもののみを使用してください
2. 過去の履歴から適切な重量・回数を推測してください
3. 回答は必ずJSON形式で返してください

■ 利用可能な器具
- ベンチプレス
- スクワット
- デッドリフト
- 懸垂（自重）

■ 最近のトレーニング履歴
【2024-01-20】
  - ベンチプレス: 60kg×10回, 60kg×8回, 55kg×10回
  - スクワット: 80kg×10回, 80kg×8回`

async function testGemini(apiKey: string) {
  console.log('=== Gemini 2.5 Flash API Test ===\n')

  // Test 1: 大きなmaxOutputTokens + responseSchema
  console.log('--- Test 1: maxOutputTokens=8192 + responseSchema ---')
  try {
    const response1 = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: testPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: PLAN_RESPONSE_SCHEMA,
        },
      }),
    })

    console.log(`Status: ${response1.status}`)
    const data1 = await response1.json()
    console.log('Response:')
    console.log(JSON.stringify(data1, null, 2))

    const text1 = data1.candidates?.[0]?.content?.parts?.[0]?.text
    if (text1) {
      console.log('\n--- Extracted text ---')
      console.log(text1)
      console.log('\n--- Parse attempt ---')
      try {
        const parsed = JSON.parse(text1)
        console.log('✅ JSON parse succeeded!')
        console.log(JSON.stringify(parsed, null, 2))
      } catch (e) {
        console.log('❌ JSON parse failed:', e)
      }
    }
  } catch (e) {
    console.error('Request failed:', e)
  }

  // Test 2: thinkingConfigで思考を無効化
  console.log('\n\n--- Test 2: thinkingConfig disabled + responseSchema ---')
  try {
    const response2 = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: testPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: PLAN_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    })

    console.log(`Status: ${response2.status}`)
    const data2 = await response2.json()
    console.log('Response:')
    console.log(JSON.stringify(data2, null, 2))

    const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text
    if (text2) {
      console.log('\n--- Extracted text ---')
      console.log(text2)
      console.log('\n--- Parse attempt ---')
      try {
        const parsed = JSON.parse(text2)
        console.log('✅ JSON parse succeeded!')
        console.log(JSON.stringify(parsed, null, 2))
      } catch (e) {
        console.log('❌ JSON parse failed:', e)
      }
    }
  } catch (e) {
    console.error('Request failed:', e)
  }

  // Test 3: Gemini 2.0 Flash (比較用)
  console.log('\n\n--- Test 3: Gemini 2.0 Flash (comparison) ---')
  try {
    const response3 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: testPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    })

    console.log(`Status: ${response3.status}`)
    const data3 = await response3.json()
    console.log('Response:')
    console.log(JSON.stringify(data3, null, 2))

    const text3 = data3.candidates?.[0]?.content?.parts?.[0]?.text
    if (text3) {
      console.log('\n--- Extracted text ---')
      console.log(text3)
    }
  } catch (e) {
    console.error('Request failed:', e)
  }
}

// Main
const apiKey = process.argv[2]
if (!apiKey) {
  console.error('Usage: npx tsx scripts/test-gemini.ts <API_KEY>')
  process.exit(1)
}

testGemini(apiKey)
