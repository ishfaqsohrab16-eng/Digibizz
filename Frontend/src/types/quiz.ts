export interface QuizFormData {
  quiz_title: string;
  tb_id: number;
  t_id: number;
  quiz_tab_change: "ON" | "OFF";
  quiz_passing_score: number;
  quiz_time_limit: number;
  quiz_attempts_limit: number;
  quiz_result_answers: "ON" | "OFF";
  questions: {
    q_title: string;
    a1: string;
    a2: string;
    a3: string;
    a4: string;
    correct_a: string;
    correct_a_reason: string;
  }[];
}

export interface Quiz {
  questionCount: any;
  question_count: any;
  quiz_id: number;
  quiz_code: string;
  quiz_title: string;
  quiz_passing_score: number;
  quiz_time_limit: number;
  quiz_attempts_limit: number;
  quiz_created_on: string;
  questions: {
    question_count: number;
  }[];
}
export interface QuizAttemptFormData {
  attempt_id?: number;
  attempt_session: string;
  quiz_code: string;
  user_id: number;
  tb_id: number;
  course_id: number;
  center_id: number;
  marks_obt: number;
  attempt_date: string;
  attempt_start_time: string;
  attempt_end_time: string;
  attempt_status: number;
  transformedData?: TransformedQuizData; // Add this for the quiz content
}
export interface QuizSubmissionResponse {
  message: string;
  result: {
    score: string;
    passed: boolean;
    total_questions: number;
    correct_answers: number;
    answers?: Array<{
      q_id: number;
      q_title: string;
      correct_answer: string;
      correct_reason: string;
    }>;
  };
}

interface ApiQuestion {
  q_id: number;
  quiz_code: string;
  q_title: string;
  a1: string;
  a2: string;
  a3: string;
  a4: string;
  correct_a: string;
  correct_a_reason: string;
}

interface ApiQuiz {
  quiz_id: number;
  quiz_code: string;
  quiz_title: string;
  quiz_time_limit: number;
  quiz_passing_score: number;
}

export interface TransformedQuizData {
  quizTitle: string;
  totalTime: number;
  startTime: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

export const transformQuizData = (
  quiz: ApiQuiz,
  questions: ApiQuestion[]
): TransformedQuizData => {
  const getCorrectAnswer = (question: ApiQuestion): string => {
    const answerMap: { [key: string]: number } = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
    };
    const answers = [question.a1, question.a2, question.a3, question.a4];
    return answers[answerMap[question.correct_a]];
  };

  return {
    quizTitle: quiz.quiz_title,
    totalTime: quiz.quiz_time_limit * 60, // Convert minutes to seconds
    startTime: new Date().toISOString(),
    questions: questions.map((q) => ({
      id: q.q_id,
      question: q.q_title,
      options: [q.a1, q.a2, q.a3, q.a4],
      correctAnswer: getCorrectAnswer(q),
    })),
  };
};
