import type { ZodError } from "zod";

type CreateBetDraft = {
  question: string;
  closesAt: string;
  options: string[];
};

export function validateCreateBetDraft(input: CreateBetDraft) {
  const question = input.question.trim();
  if (question.length < 6) {
    return "A pergunta precisa ter ao menos 6 caracteres.";
  }
  if (question.length > 255) {
    return "A pergunta deve ter no máximo 255 caracteres.";
  }

  const closesAtMs = new Date(input.closesAt).getTime();
  if (!Number.isFinite(closesAtMs)) {
    return "Horário inválido.";
  }
  if (closesAtMs <= Date.now()) {
    return "Escolha um horário futuro para encerrar a aposta.";
  }

  if (input.options.length < 2) {
    return "A aposta precisa ter ao menos 2 opções.";
  }
  if (input.options.length > 6) {
    return "A aposta pode ter no máximo 6 opções.";
  }

  for (const option of input.options) {
    if (option.length === 0) {
      return "As opções não podem ficar vazias.";
    }
    if (option.length > 255) {
      return "Cada opção deve ter no máximo 255 caracteres.";
    }
  }

  return null;
}

export function formatCreateBetSchemaError(error: ZodError) {
  const issue = error.issues[0];
  if (!issue) {
    return "Payload inválido.";
  }

  const field = issue.path[0];
  if (field === "question") {
    if (issue.code === "too_small") {
      return "A pergunta precisa ter ao menos 6 caracteres.";
    }
    if (issue.code === "too_big") {
      return "A pergunta deve ter no máximo 255 caracteres.";
    }
    return "Pergunta inválida.";
  }

  if (field === "closesAt") {
    return "Horário inválido.";
  }

  if (field === "options") {
    if (issue.path.length > 1) {
      if (issue.code === "too_big") {
        return "Cada opção deve ter no máximo 255 caracteres.";
      }
      return "As opções não podem ficar vazias.";
    }

    if (issue.code === "too_small") {
      return "A aposta precisa ter ao menos 2 opções.";
    }
    if (issue.code === "too_big") {
      return "A aposta pode ter no máximo 6 opções.";
    }
    return "Opções inválidas.";
  }

  return "Payload inválido.";
}
