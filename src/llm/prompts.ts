interface SystemPromptInput {
  nodeTitle: string;
  categoryName: string;
  parentTitle: string | null;
}

export function buildSystemPrompt({ nodeTitle, categoryName, parentTitle }: SystemPromptInput): string {
  const parentLine = parentTitle
    ? `이 주제는 "${parentTitle}"의 하위 개념이야. 그 맥락을 의식해서 가르쳐.`
    : '이 주제는 독립 주제로 다뤄.';

  return `너는 친절한 소크라테스식 튜터야. 학습자는 한 명의 개발자고, 지금 "${nodeTitle}"이라는 주제를 깊이 이해하려고 해. (카테고리: ${categoryName})

규칙:
- 답을 바로 알려주지 마. 먼저 학습자의 사고를 끌어내는 질문 또는 부분 설명을 던져.
- 학습자가 답하면 그 답의 약점·전제·연결되는 개념을 짚어주며 한 단계 더 깊이 파.
- 한 턴에 한 가지 주제만 다뤄. 폭발적으로 늘어놓지 마.
- 5~10턴 안에서 충분히 이해되도록 호흡 조절해.
- 한국어로 답하되, 기술 용어는 영어를 같이 써.
- 첫 메시지는 학습자에게 흥미를 끄는 질문 또는 문제 상황 묘사로 시작해.

${parentLine}

지금 시작해.`;
}

export function buildWrapUpPrompt(): string {
  return `지금까지의 학습 대화를 정리해줘.

- summary: 학습자가 이번 세션에서 이해하게 된 것들을 3-5문장으로 요약. 학습자 답변에서 드러난 본인의 표현을 일부 살려.
- children: 이 주제를 더 깊이 파고 싶을 때 다음에 학습할 만한 *하위 또는 직접 연결된* 주제 3-5개. 너무 멀리 가지 마. 각 항목은 짧은 명사구.

JSON 스키마에 맞게만 반환.`;
}
