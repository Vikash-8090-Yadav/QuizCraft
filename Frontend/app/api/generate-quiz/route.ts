import { type NextRequest, NextResponse } from "next/server"
import type { Quiz } from "@/types"

export async function POST(request: NextRequest) {
  try {
    const { category, difficulty = "medium" } = await request.json()

    // Mock quiz generation - replace with actual AI API call
    const mockQuiz: Quiz = {
      id: `quiz_${Date.now()}`,
      category,
      questions: [
        {
          id: "1",
          question: "What is the capital of France?",
          options: ["London", "Berlin", "Paris", "Madrid"],
          correctAnswer: 2,
          timeLimit: 30,
        },
        {
          id: "2",
          question: "Which planet is known as the Red Planet?",
          options: ["Venus", "Mars", "Jupiter", "Saturn"],
          correctAnswer: 1,
          timeLimit: 30,
        },
        {
          id: "3",
          question: "What is 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: 1,
          timeLimit: 30,
        },
        {
          id: "4",
          question: "Who painted the Mona Lisa?",
          options: ["Van Gogh", "Picasso", "Da Vinci", "Monet"],
          correctAnswer: 2,
          timeLimit: 30,
        },
        {
          id: "5",
          question: "What is the largest ocean on Earth?",
          options: ["Atlantic", "Indian", "Arctic", "Pacific"],
          correctAnswer: 3,
          timeLimit: 30,
        },
      ],
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    return NextResponse.json(mockQuiz)
  } catch (error) {
    console.error("Error generating quiz:", error)
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 })
  }
}
