import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const {
      category = "Technology",
      difficulty = "medium",
      questionCount = 1,
      timePerQuestion = 30,
    } = await request.json()

    // Compose a prompt for Perplexity
    const prompt = `Generate exactly 10 ${difficulty} multiple-choice quiz questions about ${category}.
Return STRICT JSON ONLY with NO prose, NO markdown, NO code fences.
Ensure questions are diverse and non-repetitive. Vary phrasing, subtopics, and difficulty within the band.
Return a JSON array of 10 objects, each with this schema:
{
  "question": string,
  "options": [string, string, string, string],
  "answer": string,
  "explanation": string
}`

    // Perplexity API key from environment or provided fallback
    const apiKey = process.env.PPLX_API_KEY || "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"

    const callPerplexity = async (model: string, temp = 0.5) => {
      if (!apiKey) {
        return { ok: false, status: 0, content: "" as string }
      }
      const resp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2048,
          temperature: temp,
        }),
      })

      if (!resp.ok) {
        let errorInfo: any = undefined
        try { errorInfo = await resp.json() } catch {}
        console.error("Perplexity API error:", resp.status, errorInfo || (await resp.text?.()))
        return { ok: false, status: resp.status, content: "" as string }
      }
      const data = await resp.json()
      const content: string = data.choices?.[0]?.message?.content ?? ""
      return { ok: true, status: 200, content }
    }

    // First attempt with a capable model
    let p = await callPerplexity("sonar-pro", 0.2)
    // Retry with alternate models if needed
    if (!p.ok || !p.content) p = await callPerplexity("sonar", 0.2)
    if (!p.ok || !p.content) p = await callPerplexity("pplx-70b-online", 0.2)

    let content = p.content || ""

    // Normalize AI output into questions array that the client expects
    const toQuestions = (raw: any): Array<{ id: string; question: string; options: string[]; correctAnswer: number; timeLimit: number; explanation: string }> => {
      const ensureIndex = (options: string[], answer: string): number => {
        const idx = options.findIndex((o) => o.trim().toLowerCase() === String(answer || "").trim().toLowerCase())
        return idx >= 0 ? idx : 0
      }

      const toQuestion = (obj: any) => {
        const options: string[] = Array.isArray(obj?.options) ? obj.options.slice(0, 4) : []
        const correctAnswer = ensureIndex(options, obj?.answer)
        const derivedExplanation = options[correctAnswer]
          ? `The correct answer is "${options[correctAnswer]}".`
          : "The provided answer matches the first option."
        return {
          id: (globalThis as any).crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
          question: String(obj?.question ?? "Failed to generate question."),
          options,
          correctAnswer,
          timeLimit: Number(timePerQuestion) || 30,
          explanation: String(obj?.explanation ?? derivedExplanation),
        }
      }

      if (Array.isArray(raw)) {
        return raw.map(toQuestion)
      }
      return [toQuestion(raw)]
    }

    let parsed: any
    try {
      // Some models may wrap JSON in code fences; try to extract JSON substring first
      const jsonMatch = content?.match(/```(?:json)?\n([\s\S]*?)```/i)
      const toParse = jsonMatch ? jsonMatch[1] : content
      parsed = JSON.parse(toParse)
    } catch (e) {
      // If the model didn't return strict JSON, fall back to a single placeholder question
      parsed = {
        question: "Failed to generate question.",
        options: ["A", "B", "C", "D"],
        answer: "A",
        explanation: "The correct answer is \"A\".",
      }
    }

    let questions = toQuestions(parsed)

    // Shuffle options and re-index correctAnswer to avoid positional bias
    const shuffle = <T,>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
      }
      return arr
    }

    const postProcess = (items: typeof questions) => {
      const seen = new Set<string>()
      const unique: typeof questions = []
      for (const q of items) {
        // Deduplicate by normalized question text
        const key = q.question.trim().toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        // Shuffle options and recompute correct index
        const originalCorrect = q.options[q.correctAnswer]
        const shuffled = shuffle([...q.options])
        const newCorrectIndex = Math.max(0, shuffled.findIndex(o => o === originalCorrect))
        unique.push({ ...q, options: shuffled, correctAnswer: newCorrectIndex })
      }
      return unique
    }

    questions = postProcess(questions)

    // Local fallback generator if AI failed or produced empty/invalid content
    const needsLocalFallback =
      !p.ok ||
      !questions.length ||
      questions.every(q => !q.question || q.options.length < 2) ||
      questions.some(q => String(q.question).toLowerCase().includes("failed to generate question")) ||
      questions.length < Number(questionCount)

    if (needsLocalFallback) {
      const localGenerate = (topic: string, count: number) => {
        const bank: Array<{ question: string; options: string[]; correctAnswer: number; explanation: string }> = [
          { question: `${topic}: What does CPU stand for?`, options: ["Central Processing Unit", "Computer Personal Unit", "Central Peripheral Unit", "Compute Process Utility"], correctAnswer: 0, explanation: 'CPU stands for "Central Processing Unit".' },
          { question: `${topic}: Which language runs in a web browser?`, options: ["Java", "C", "Python", "JavaScript"], correctAnswer: 3, explanation: 'JavaScript is the language that runs in the browser.' },
          { question: `${topic}: What is the value of 2^5?`, options: ["16", "32", "64", "8"], correctAnswer: 1, explanation: '2^5 equals 32.' },
          { question: `${topic}: HTTP status 404 means?`, options: ["Server Error", "Unauthorized", "Not Found", "Forbidden"], correctAnswer: 2, explanation: '404 indicates the requested resource was not found.' },
          { question: `${topic}: Which is a NoSQL database?`, options: ["MySQL", "MongoDB", "PostgreSQL", "SQLite"], correctAnswer: 1, explanation: 'MongoDB is a NoSQL document database.' },
          { question: `${topic}: What does RAM stand for?`, options: ["Random Access Memory", "Rapid Access Memory", "Readily Available Memory", "Runtime Active Memory"], correctAnswer: 0, explanation: 'RAM stands for "Random Access Memory".' },
          { question: `${topic}: What is Git used for?`, options: ["Text editing", "Version control", "Image processing", "Virtualization"], correctAnswer: 1, explanation: 'Git is a distributed version control system.' },
          { question: `${topic}: CSS stands for?`, options: ["Colorful Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Creative Style System"], correctAnswer: 1, explanation: 'CSS stands for "Cascading Style Sheets".' },
          { question: `${topic}: Which company developed TypeScript?`, options: ["Google", "Facebook", "Microsoft", "Amazon"], correctAnswer: 2, explanation: 'TypeScript was developed by Microsoft.' },
          { question: `${topic}: Which framework is for React routing?`, options: ["Vuex", "Next.js", "Laravel", "Django"], correctAnswer: 1, explanation: 'Next.js is a React framework that includes routing.' },
        ]
        const result: Array<{ id: string; question: string; options: string[]; correctAnswer: number; timeLimit: number; explanation: string }> = []
        for (let i = 0; i < Math.min(count, bank.length); i++) {
          const item = bank[i]
          // Shuffle local options too and rotate correct index
          const opts = [...item.options]
          for (let s = opts.length - 1; s > 0; s--) {
            const j = Math.floor(Math.random() * (s + 1))
            const t = opts[s]; opts[s] = opts[j]; opts[j] = t
          }
          const newCorrect = Math.max(0, opts.findIndex(o => o === item.options[item.correctAnswer]))
          result.push({
            id: Math.random().toString(36).slice(2),
            question: item.question,
            options: opts,
            correctAnswer: newCorrect,
            timeLimit: Number(timePerQuestion) || 30,
            explanation: item.explanation,
          })
        }
        return result
      }
      questions = localGenerate(category, Number(questionCount) || 10)
      questions = postProcess(questions)
    }

    const responsePayload: any = {
      success: true,
      quiz: {
        id: (globalThis as any).crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
        category,
        timePerQuestion: Number(timePerQuestion) || 30,
        questions,
      },
    }

    // Attach debug info in development to diagnose AI issues
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.debug = {
        hadApiKey: Boolean(apiKey),
        usedModel: p.ok ? (content ? (content.length > 0 ? "resolved" : "empty_content") : "no_content") : "failed",
        fallbackUsed: needsLocalFallback,
        rawContentBytes: typeof content === 'string' ? content.length : 0,
        parsedType: Array.isArray(parsed) ? 'array' : typeof parsed,
        questionCount: questions.length,
      }
    }

    // If AI failed, we still return success true with local questions
    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error("Error generating quiz:", error)
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 })
  }
}