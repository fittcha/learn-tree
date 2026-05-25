# learn-tree

AI 기반 소크라테스식 학습 앱. 주제를 트리 구조로 관리하고, AI 튜터와 대화하며 학습한다.

## 핵심 아이디어

- 읽기만 해서는 내 지식이 안 된다. **AI가 질문을 던지고, 내가 답하는** 구조로 강제 사고.
- 완료된 학습은 **요약노트 + 다이어그램**으로 자동 정리.
- 학습 주제는 **카테고리/부모-자식 트리**로 성장. AI가 다음 학습 주제를 제안.

## 흐름

```
그래프 뷰 → 노드 클릭 → AI 대화 → 마무리 → 학습요약노트 + 흐름도
                                          → 하위 주제 제안 → 새 노드 생성
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | React 19 + TypeScript 6.0 (strict) |
| 빌드 | Vite 8 |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite`) |
| 상태관리 | Zustand 5 |
| DB | IndexedDB via Dexie 4 (로컬, 서버 없음) |
| LLM | Groq API (Llama 3.3 70B) — 사용자 API 키 |
| 그래프 | React Flow (`@xyflow/react` v12) |
| 다이어그램 | Mermaid.js |
| 테스트 | Vitest + fake-indexeddb |
| 배포 | Docker (nginx) + PWA |

## 빠른 시작

### 로컬 개발

```bash
npm install
npm run dev        # http://localhost:5173
```

### Docker (권장)

```bash
docker compose up -d --build   # http://localhost:9090
```

### PWA 설치

Chrome에서 `localhost:9090` 접속 → 주소창 오른쪽 설치 아이콘 클릭 → 독립 앱으로 사용.

## 사용법

1. **Settings**에서 Groq API 키 입력 (https://console.groq.com 에서 무료 발급)
2. 그래프 뷰에서 **"+ 새 주제"** 클릭 → 카테고리 선택 → 주제명 입력
3. AI 튜터와 대화 (소크라테스식 — AI가 질문, 내가 답)
4. 충분히 학습했으면 **"이쯤에서 마무리"** 클릭
5. 학습요약노트(핵심 개념, 동작 흐름, 키워드, 흐름도) 자동 생성
6. AI가 제안한 하위 주제로 다음 학습 노드 생성

## 프로젝트 구조

```
src/
├── data/          # Dexie DB, 타입, CRUD (categories, nodes, sessions, settings)
├── llm/           # Groq 어댑터, 프롬프트, useChatTurn, useWrapUp 훅
├── export/        # Obsidian 마크다운 변환, File System Access API
├── state/         # Zustand 스토어 (화면 라우팅, 상태)
├── screens/       # GraphView, ChatMode, WikiMode, Settings
└── App.tsx        # 루트 컴포넌트
```

## 테스트

```bash
npm test           # 34 tests (9 suites)
```

데이터 계층, LLM 어댑터, 마크다운 export에 대한 단위 테스트.

## 기본 카테고리

| 카테고리 | 색상 |
|----------|------|
| CS | 파랑 |
| 프로그래밍 | 초록 |
| 기술 | 노랑 |
| AI | 보라 |

## 브라우저

Chromium 기반 (Chrome, Edge, Arc, Brave). Obsidian export는 File System Access API를 사용하므로 Firefox/Safari 미지원.

## 설계 변경 이력

v1 설계 문서(`docs/plans/2026-05-17-learn-tree-design.md`) 이후 변경:

- **LLM 교체**: Gemini 2.0 Flash → Groq (Llama 3.3 70B). Gemini 무료 티어 제한으로 변경.
- **PWA + Docker**: nginx 기반 정적 파일 서빙 (포트 9090). 서비스 워커로 오프라인 캐시.
- **학습요약노트**: 마무리 시 핵심 개념 / 동작 흐름 / 키워드 정리 / 학습자 메모를 마크다운으로 생성.
- **Mermaid 다이어그램**: 학습 주제의 흐름을 시각적으로 표시.
- **Session.diagram 필드**: DB v3 마이그레이션 추가.
- **apiKey 일반화**: `geminiApiKey` → `apiKey`로 프로바이더 비의존적 네이밍.
