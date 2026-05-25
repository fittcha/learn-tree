interface SystemPromptInput {
  nodeTitle: string;
  categoryName: string;
  parentTitle: string | null;
}

export function buildSystemPrompt({ nodeTitle, categoryName, parentTitle }: SystemPromptInput): string {
  const parentLine = parentTitle
    ? `"${parentTitle}"의 하위 개념이야.`
    : '';

  return `소크라테스식 튜터. 주제: "${nodeTitle}" (${categoryName})${parentLine ? ` — ${parentLine}` : ''}

규칙:
- 답을 바로 주지 마. 질문으로 사고를 유도해.
- 한 턴에 한 가지만. 짧고 명확하게.
- 한국어로만 답해. 기술 용어는 영어 병기 가능. 다른 언어 금지.
- 첫 메시지는 흥미로운 질문으로 시작.`;
}

export function buildWrapUpPrompt(): string {
  return `위 대화 전체를 꼼꼼히 읽고, 학습요약노트를 작성해. JSON으로만 응답. 반드시 한국어로만 작성 (기술 용어는 영어 병기). 중국어, 일본어, 베트남어 등 다른 언어 절대 금지.

- summary: 학습요약노트. 마크다운 형식. 대화에서 실제로 다룬 모든 개념을 빠짐없이 포함해야 함.
  - "## 핵심 개념" 섹션: 대화에서 다룬 모든 주요 개념을 bullet point로 정리. 최소 5개 이상. 각 개념에 대해 2-3줄로 구체적으로 설명. 예시나 비유가 대화에 있었다면 포함.
  - "## 동작 흐름" 섹션: 이 주제의 전체 프로세스를 단계별로 번호 매겨 상세히 설명. 각 단계마다 무슨 일이 일어나는지, 어떤 프로토콜/기술이 관여하는지 적어.
  - "## 핵심 용어" 섹션: 대화에서 등장한 모든 기술 용어를 "**용어 (English)**: 설명" 형태로 나열. 최소 8개 이상.
  - "## 학습자 메모" 섹션: 학습자가 헷갈려한 부분, 잘못 이해했다가 교정된 부분, 또는 추가 학습이 필요한 부분을 정리.
- diagram: mermaid 다이어그램. 반드시 graph TD 형식으로 작성. 노드 ID는 영어, 라벨은 한국어. 예시: graph TD\\n  A["클라이언트"] --> B["DNS 서버"]\\n  B --> C["웹 서버"]. 코드펜스는 붙이지 마.
- children: 다음에 학습할 하위 주제 3-5개 (짧은 명사구).`;
}
