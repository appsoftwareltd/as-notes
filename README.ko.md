> **참고:** 이 문서는 README.md의 번역본입니다. 원본 영어 버전이 이 버전보다 더 최신 내용을 포함할 수 있습니다.

# AS Notes (개인 지식 관리 VS Code 확장 프로그램)

웹사이트: [asnotes.io](https://www.asnotes.io) | 개발자: [App Software Ltd](https://www.appsoftware.com) | [Discord](https://discord.gg/QmwY57ts) | [Reddit](https://www.reddit.com/r/AS_Notes/) | [X](https://x.com/AppSoftwareLtd)

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/appsoftwareltd.as-notes?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![License](https://img.shields.io/badge/license-Elastic--2.0-lightgrey)](https://github.com/appsoftwareltd/as-notes/blob/main/LICENSE)
[![CI](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml)

|||
|--|--|
|설치 | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes) / [Open VSX](https://open-vsx.org/extension/appsoftwareltd/as-notes)|
|Pro 기능 | [asnotes.io/pricing](https://www.asnotes.io?attr=src_readme)|
|문서 | [docs.asnotes.io](https://docs.asnotes.io)|
|블로그 | [blog.asnotes.io](https://blog.asnotes.io)|
|로드맵 / 프로젝트 보드| [docs.asnotes.io/development-roadmap](https://docs.asnotes.io/development-roadmap.html) / [github.com](https://github.com/orgs/appsoftwareltd/projects/16)|

## AS Notes란?

**AS Notes는 마크다운과 `[[wikilink]]` 편집 기능을 [VS Code](https://code.visualstudio.com/) 및 호환 편집기(예: [Antigravity](https://antigravity.google/), [Cursor](https://cursor.com/), [Windsurf](https://windsurf.com/))에 직접 통합하여 노트, 문서, 블로그, 위키를 작성할 수 있게 합니다.**

**아이디어를 기록하고, 개념을 연결하고, 글을 쓰며 집중하세요 - 편집기를 떠나지 않고.**

AS Notes는 즐겨 사용하는 IDE를 개인 지식 관리 시스템(PKMS)으로 전환하는 생산성 도구를 제공합니다. 백링크 보기, 작업 관리, 저널, 칸반 보드, 마크다운 편집 도구, Mermaid 다이어그램, LaTeX 수학 공식 지원 및 Jekyll / Hugo와 유사한 정적 사이트 게시 기능을 포함합니다.

(1분 소개 영상)

[![AS Notes 데모](https://img.youtube.com/vi/bwYopQ1Sc5o/maxresdefault.jpg)](https://www.youtube.com/watch?v=bwYopQ1Sc5o)

(1분 데모 영상)

[![AS Notes 데모](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## 왜 VS Code인가?

우리 중 많은 사람이 매일 VS Code와 호환 편집기를 사용하며, 노트와 지식 관리에 별도의 도구를 사용하더라도 IDE에서 문서, 블로그, 위키를 작성하는 경우가 많습니다. AS Notes는 IDE에서 모든 것을 할 수 있는 도구를 제공합니다.

AS Notes가 직접 제공하는 기능 외에 VS Code에서 노트를 관리하는 주요 이점:

- 크로스 플랫폼 호환성 + 웹 (Workspaces를 통해)
- 다른 지식 관리 도구가 허용되지 않을 수 있는 제한된 업무 환경에서의 수용성
- AS Notes와 함께 사용하여 기능을 더욱 확장할 수 있는 방대한 확장 프로그램 라이브러리
- 노트 작업에 사용할 수 있는 내장 AI 에이전트 하네스 (GitHub CoPilot / Claude 등)
- 최첨단 텍스트 편집 및 UI 기능
- 구문 강조
- VS Code가 가진 다른 모든 기능

## AS Notes 기능

### 일반 기능

- 개인정보 보호 중심 - AS Notes는 데이터나 원격 측정을 어디에도 전송하지 않습니다
- 버전 관리 친화적 (Git & GitOps)
- 경량 노트 인덱싱 (로컬 sqlite3 WASM)

- 대규모(약 2만 개의 마크다운 파일) 지식 베이스에서도 뛰어난 성능

### 위키 링크

- Logseq / Roam / Obsidian 스타일의 `[[wikilinks]]`와 중첩 링크 지원 (예: `[[[[AS Notes]] Page]]`)
- 링크는 워크스페이스 어디에서든 대상 페이지로 해석됩니다. 중첩 위키 링크는 여러 대상을 해석할 수 있습니다
- 링크 이름 변경 시 대상 파일과 모든 일치하는 참조가 업데이트됩니다
- 자동 위키 링크 / 파일 이름 변경 추적

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/wikilinks.png" alt="AS Notes backlinks wikilinks" style="max-height:200px; margin-top: 10px">

위키 링크에 대한 자세한 내용은 [위키 링크 문서](https://docs.asnotes.io/wikilinks.html)를 참조하세요.

### 작업 관리

`Ctrl+Shift+Enter` (Windows/Linux) / `Cmd+Shift+Enter` (macOS)로 마크다운 TODO 전환:

```
- [ ] 할 일 마커 추가됨
- [x] 할 일 완료로 표시됨
할 일 마커 제거됨
```

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/task-management-panel.png" alt="AS Notes todo panel" style="max-height:260px; margin-top: 10px; margin-bottom: 10px;">

#### 작업 메타데이터 태그

작업 줄의 어디에나 구조화된 해시태그 메타데이터를 추가하여 작업을 분류하고 정리합니다. 태그는 표시되는 작업 텍스트에서 제거되며, 깨끗한 설명만 표시됩니다.

| 태그 | 설명 |
|---|---|
| `#P1` | 우선순위 1 - 긴급 |
| `#P2` | 우선순위 2 - 높음 |
| `#P3` | 우선순위 3 - 보통 |
| `#W` | 대기 중 - 작업이 차단되었거나 누군가/무언가를 기다리는 중 |
| `#D-YYYY-MM-DD` | 마감일 - 예: `#D-2026-03-15` |
| `#C-YYYY-MM-DD` | 완료일 - 예: `#C-2026-03-15` |

사용 예:

```markdown
- [ ] #P1 심각한 프로덕션 버그 수정
- [ ] #P2 #W 새 대시보드 디자인 승인 대기 중
- [x] #D-2026-03-10 분기 보고서 제출
```

여러 태그를 조합할 수 있습니다. 우선순위 태그는 하나만 사용됩니다 - 두 개 이상 있으면 첫 번째가 적용됩니다.

#### 작업 관리

**AS Notes** 활동 표시줄 아이콘으로 작업 사이드바를 열어 전체 워크스페이스의 모든 작업을 표시합니다.

**그룹화 기준** - 작업 그룹화 방식 선택:

| 보기 | 설명 |
|---|---|
| **페이지** | 작업을 소스 페이지 이름 알파벳순으로 그룹화 |
| **우선순위** | 작업을 우선순위 수준별로 그룹화 (P1 → P2 → P3 → 우선순위 없음), 각 그룹 내에서 마감일순 정렬 |
| **마감일** | 작업을 마감일별로 그룹화 |
| **완료일** | 작업을 완료일별로 그룹화 |

**필터:**

- **할 일만** - 미완료 작업만 표시 (기본 켜짐)
- **대기 중만** - `#W` 태그가 있는 작업만 표시
- **페이지별 필터** - 텍스트를 입력하여 이름에 검색 텍스트가 포함된 페이지로 범위 축소 (대소문자 구분 없음)

### 백링크 패널

백링크 패널은 페이지에 대한 참조를 표시합니다. 참조는 페이지 언급, 아웃라이너 스타일의 다른 위키 링크 아래 들여쓰기 또는 다른 위키 링크 내의 중첩으로 캡처됩니다. 백링크 추적은 주변 컨텍스트를 캡처하고, 전방 참조(위키 링크가 있지만 아직 생성되지 않은 페이지)에서 작동하며, 인덱스 변경 시 실시간으로 업데이트됩니다.

다음 단축키로 현재 탭 옆에 백링크 편집기 탭 열기: `Ctrl+Alt+B` (Windows/Linux) / `Cmd+Alt+B` (macOS)

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/as-notes-backlink-panel.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

#### 보기 모드

패널은 패널 헤더의 버튼으로 전환 가능한 두 가지 보기 모드를 지원합니다:

- **페이지별 평면 보기** (기본) - 모든 백링크 인스턴스를 소스 페이지 이름의 알파벳순으로 정렬. 저널 파일이 시간순으로 정렬되는 선형 타임라인 보기.
- **체인별 그룹 보기** - 백링크를 체인 패턴(페이지 이름의 순서)별로 그룹화하고, 접을 수 있는 헤더 포함. 개념 기반 탐색에 유용.

기본 모드는 `as-notes.backlinkGroupByChain` (기본값 `false`)으로 설정.

별도의 토글로 **컨텍스트 상세도** 제어 - 간결 (한 줄, 잘림) 또는 줄 바꿈 (전체 텍스트 표시). 기본값은 `as-notes.backlinkWrapContext` (기본값 `false`)로 설정.

#### 체인 우선 표시

- **패턴 그룹화** - 백링크가 체인 패턴별로 그룹화됩니다 (예: 다른 파일의 모든 `[[Project]] → [[Tasks]] → [[NGINX]]`가 하나의 그룹에 표시).
- **단독 언급** - 직접 `[[wikilink]]` 참조는 단일 링크 체인으로 표시되며, 먼저 정렬됩니다.
- **아웃라인 컨텍스트** - 위키 링크가 다른 위키 링크 아래에 들여쓰기된 경우, 전체 계층이 체인으로 표시됩니다 (예: `Page A → Page B → Page C`), 각 링크는 클릭 가능.
- **링크별 줄 번호** - 각 체인 링크에 줄 번호 표시 (예: `[L12]`), 정확한 탐색용.
- **줄 컨텍스트** - 각 체인 인스턴스는 위키 링크가 강조 표시된 주변 줄 텍스트를 표시하여, 파일을 열지 않고도 즉각적인 컨텍스트를 제공.
- **대소문자 구분 없는 그룹화** - `[[server]]`와 `[[Server]]`는 같은 체인 패턴을 생성합니다.

#### 컨텍스트 메뉴 - 백링크 보기

편집기에서 위키 링크를 마우스 오른쪽 버튼으로 클릭하여 해당 특정 페이지의 백링크를 열기:

- 별칭 지원 - 위키 링크가 별칭을 대상으로 하는 경우, 정규 페이지의 백링크가 표시됩니다.
- 전방 참조 지원 - 아직 존재하지 않는 페이지에서도 수신 링크가 표시됩니다.

### 칸반 보드

AS Notes에는 마크다운 파일로 지원되는 내장 칸반 보드가 있으며, AS Notes의 다른 페이지와 마찬가지로 사용하고 편집할 수 있습니다.

칸반 보드를 사용하여 장기 프로젝트를 추적하세요. 표준 작업은 AS Notes의 다른 노트와 마찬가지로 칸반 카드 파일에서 사용할 수 있습니다.

### 일일 저널

**Ctrl+Alt+J** (macOS에서는 Cmd+Alt+J)를 눌러 오늘의 일일 저널 페이지를 생성하거나 엽니다.

저널 파일은 전용 `journals/` 폴더(설정 가능)에 `YYYY-MM-DD.md`로 생성됩니다. 새 페이지는 템플릿 폴더(기본값: `templates/`)의 `Journal.md` 템플릿에서 생성됩니다. `Journal.md`를 편집하여 자신만의 섹션과 프롬프트를 추가하세요. 모든 템플릿 플레이스홀더가 지원됩니다 -- [템플릿](#템플릿-pro)을 참조하세요.

사이드바의 **캘린더** 패널은 저널 표시기가 있는 현재 월을 표시합니다. 아무 날이나 클릭하여 저널 항목을 엽니다. 자세한 내용은 [캘린더](#캘린더)를 참조하세요.

> **참고:** 일일 저널은 초기화된 워크스페이스(`.asnotes/` 디렉토리)가 필요합니다. [시작하기](#시작하기)를 참조하세요.

### 다른 마크다운 PKMS와의 호환성

AS Notes는 유사한 파일 구조로 인해 Obsidian이나 Logseq로 만든 지식 베이스와 함께 사용할 수 있습니다. 다만 형식과 동작의 차이가 있다는 점을 유의하세요.

### 슬래시 명령

마크다운 파일에서 `/`를 입력하여 빠른 명령 메뉴를 엽니다. 계속 입력하여 목록을 필터링하고, Enter로 명령을 실행하거나, Escape로 닫고 `/`를 남겨둡니다. 슬래시 명령은 펜스 코드 블록, 인라인 코드 스팬, YAML 프론트매터 내에서 억제됩니다.

#### 표준 명령

| 명령 | 동작 |
|---|---|
| **Today** | 오늘 날짜의 위키 링크 삽입 (예: `[[2026-03-06]]`) |
| **Date Picker** | 오늘 날짜가 미리 입력된 날짜 입력 상자를 엽니다. 날짜를 편집하거나 Enter를 눌러 위키 링크로 삽입 |
| **Code (inline)** | `` ` `` `` ` ``를 삽입하고 백틱 사이에 커서 배치 |
| **Code (multiline)** | 펜스 코드 블록을 삽입하고 시작 ` ``` ` 뒤에 커서 배치 -- 언어 식별자(예: `js`)를 입력한 후 Enter |

#### 게시 명령 *(프론트매터)*

이 명령은 파일의 YAML 프론트매터에서 게시 관련 필드를 전환하거나 순환합니다. 자세한 내용은 [정적 사이트 게시](#정적-사이트-게시)를 참조하세요.

| 명령 | 동작 |
|---|---|
| **Public** | 프론트매터에서 `public: true` / `public: false` 전환 |
| **Layout** | 프론트매터에서 `layout`을 `docs`, `blog`, `minimal`로 순환 |
| **Retina** | 프론트매터에서 `retina: true` / `retina: false` 전환 |
| **Assets** | 프론트매터에서 `assets: true` / `assets: false` 전환 |

#### 칸반 카드 명령 *(칸반 카드 파일만)*

다음 명령은 칸반 카드 파일(`kanban/card_*.md`) 편집 시에만 나타납니다.

| 명령 | 동작 |
|---|---|
| **Card: Entry Date** | 커서 위치에 `## entry YYYY-MM-DD` 제목 삽입, 오늘 날짜 미리 입력 |

#### 작업 명령 *(작업 줄만)*

이 명령은 커서가 작업 줄(`- [ ]` 또는 `- [x]`)에 있을 때만 나타납니다. 태그는 체크박스 뒤와 줄에 이미 있는 해시태그 뒤에 삽입됩니다.

| 명령 | 동작 |
|---|---|
| **Task: Priority 1** | 작업 텍스트 시작 부분에 `#P1` 삽입. 줄의 기존 우선순위 태그(`#P1`-`#P9`) 교체 |
| **Task: Priority 2** | `#P2` 삽입, 기존 우선순위 태그 교체 |
| **Task: Priority 3** | `#P3` 삽입, 기존 우선순위 태그 교체 |
| **Task: Waiting** | 작업 텍스트 시작 부분에서 `#W` 전환 (없으면 삽입, 있으면 제거) |
| **Task: Due Date** | 오늘(YYYY-MM-DD)이 미리 입력된 날짜 입력을 엽니다. 작업 텍스트 시작 부분에 `#D-YYYY-MM-DD` 삽입. 기존 마감일 태그 교체 |
| **Task: Completion Date** | 오늘(YYYY-MM-DD)이 미리 입력된 날짜 입력을 엽니다. 작업 텍스트 시작 부분에 `#C-YYYY-MM-DD` 삽입. 기존 완료일 태그 교체 |
| **Convert to Kanban Card** *(Pro)* | 작업을 완료로 표시하고, **TODO** 레인에 작업 제목(태그 제거됨), 일치하는 우선순위와 마감일, **Waiting** 플래그가 설정된 칸반 카드를 생성. 미체크 작업에서만 사용 가능 |

우선순위와 대기 태그는 토글식: 같은 태그를 다시 사용하면 제거됩니다. 다른 우선순위를 사용하면 기존 것이 교체됩니다. 마감일과 완료일 태그는 같은 유형의 기존 태그를 교체합니다.

#### Pro 명령

Pro 명령에는 Pro 라이선스가 필요합니다. 무료 사용자는 메뉴에서 **(Pro)**가 붙은 상태로 볼 수 있습니다.

| 명령 | 동작 |
|---|---|
| **Template** | 템플릿 폴더에서 템플릿 빠른 선택 목록을 열고 선택한 템플릿을 커서 위치에 삽입. 플레이스홀더 지원 ([템플릿](#템플릿-pro) 참조) |
| **Table** | 열 수와 행 수를 입력하면 포맷된 마크다운 테이블 삽입 |
| **Table: Format** | 주변 테이블의 모든 열 너비를 가장 긴 셀 내용에 맞게 정규화 |
| **Table: Add Column(s)** | 수를 입력하고 커서의 현재 열 뒤에 열 추가 |
| **Table: Add Row(s)** | 수를 입력하고 커서의 현재 행 뒤에 행 추가 |
| **Table: Remove Row (Current)** | 커서의 행 제거 (헤더/구분선 거부) |
| **Table: Remove Column (Current)** | 커서의 열 제거 (단일 열 테이블 거부) |
| **Table: Remove Row(s) Above** | 수를 입력하고 커서 위의 데이터 행 제거 (사용 가능 범위로 제한) |
| **Table: Remove Row(s) Below** | 수를 입력하고 커서 아래의 행 제거 (사용 가능 범위로 제한) |
| **Table: Remove Column(s) Right** | 수를 입력하고 커서 오른쪽의 열 제거 (사용 가능 범위로 제한) |
| **Table: Remove Column(s) Left** | 수를 입력하고 커서 왼쪽의 열 제거 (사용 가능 범위로 제한, 들여쓰기 유지) |

### 파일 드래그 앤 드롭 / 복사 + 붙여넣기

파일 관리자에서 마크다운 편집기로 파일을 드래그하거나 클립보드에서 이미지를 붙여넣기 - VS Code의 내장 마크다운 편집기가 자동으로 복사 및 링크 삽입을 처리합니다.

AS Notes는 내장 `markdown.copyFiles.destination` 워크스페이스 설정을 구성하여, 드래그/붙여넣기된 파일이 마크다운 파일 옆이 아닌 전용 에셋 폴더에 저장되도록 합니다.

| 설정 | 기본값 | 설명 |
|---|---|---|
| `as-notes.assetPath` | `assets/images` | 드래그/붙여넣기된 파일이 저장되는 워크스페이스 상대 폴더 |

이 설정은 AS Notes 초기화 시 또는 값 변경 시 자동으로 적용됩니다. 대상 폴더는 VS Code가 최초 사용 시 생성합니다.

**팁:**

- **드래그 위치 표시기:** 파일을 드래그하는 동안 **Shift**를 누르면 놓기 전에 커서 위치 가이드가 표시됩니다 - 텍스트 내에 링크를 정확히 배치하는 데 유용합니다.

### 이미지 호버 미리보기

마크다운 파일의 이미지 링크 위에 마우스를 올리면 인라인으로 이미지 미리보기를 볼 수 있습니다. 표준 구현은 VS Code의 내장 마크다운 확장 프로그램이 제공하며 설정이 필요 없습니다 - 표준 `![alt](path)` 링크와 드래그/붙여넣기된 이미지 모두에서 작동합니다. 인라인 마크다운 편집기 모드에는 향상된 이미지 표시가 포함됩니다.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/image-preview.png" alt="AS Notes Image Preview" style="max-height:300px; margin-top: 10px; margin-bottom: 10px;">

#### 코드 블록 자동 완성

코드 블록 자동 완성은 **모든** 마크다운 파일에서 작동합니다 - 아웃라이너 모드가 필요하지 않습니다.

`` ``` `` (선택적 언어, 예: `` ```javascript ``)를 입력하고 **Enter**를 누르면, AS Notes가 자동으로 닫는 `` ``` ``를 삽입하고 블록 안에 커서를 배치합니다. 글머리 기호 줄에서는 마크다운 목록 연속에 맞게 내용이 들여쓰기됩니다.

확장 프로그램은 기존 펜스 쌍을 인식합니다: 백틱이 이미 균형을 이루고 있으면(동일한 들여쓰기에 일치하는 닫는 펜스가 있으면), Enter는 두 번째 스켈레톤 대신 단순히 줄 바꿈만 삽입합니다.

아웃라이너 모드에서, 글머리 기호 코드 블록에 속하는 닫는 `` ``` `` 줄에서 Enter를 누르면 부모 들여쓰기에 새 글머리 기호가 삽입됩니다.

## AS Notes Pro 기능

**Pro 라이선스**로 프리미엄 기능이 잠금 해제됩니다. 유효한 키가 활성화되면 상태 표시줄에 **AS Notes (Pro)**가 표시됩니다.

라이선스 키를 얻으려면 [asnotes.io](https://www.asnotes.io/pricing)를 방문하세요.

**라이선스 키 입력:**

- 명령 팔레트(`Ctrl+Shift+P`)에서 **AS Notes: Enter Licence Key** 실행 - 가장 빠른 방법.
- 또는 VS Code 설정(`Ctrl+,`)을 열고 `as-notes.licenceKey`를 검색하여 키를 붙여넣기.

### 인라인 편집기 마크다운 스타일링, Mermaid & LaTeX 렌더링 (Pro)

AS Notes Pro에는 VS Code(또는 호환 편집기) 편집기 탭 내에서 선택적인 Typora와 유사한 인라인 마크다운 스타일링, Mermaid 다이어그램 및 LaTeX 렌더링이 포함됩니다. 표준 마크다운 구문 문자(`**`, `##`, `[]()` 등)는 입력 시 시각적 등가물로 대체됩니다.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/asnotes-inline-editor-markdown-styling-mermaid-andlatex-rendering.png" alt="Inline Editor Markdown Styling, Mermaid and LaTeX Rendering" style="max-height:400px; margin-top: 10px">

자세한 내용은 [인라인 편집기 마크다운 스타일링, Mermaid & LaTeX 렌더링](https://docs.asnotes.io/inline-markdown-editing-mermaid-and-latex-rendering.html)을 참조하세요.

AS Notes에는 Typora와 유사하게 텍스트 편집기 내에서 직접 포맷을 렌더링하는 내장 인라인 마크다운 편집기가 포함되어 있습니다.

**3단계 가시성:**

| 상태 | 시점 | 보이는 것 |
|---|---|---|
| **렌더링** | 커서가 다른 곳에 있을 때 | 깨끗한 포맷 텍스트 (구문 숨김) |
| **고스트** | 커서가 해당 줄에 있을 때 | 투명도가 낮아진 구문 문자 |
| **원시** | 커서가 구성 내부에 있을 때 | 전체 마크다운 소스 |

**지원되는 구성:**

굵게, 기울임, 취소선, 제목(H1-H6), 인라인 코드, 링크, 이미지, 인용 블록, 수평선, 순서 없는/작업 목록, 코드 블록(언어 레이블 포함), YAML 프론트매터, GFM 테이블, 이모지 단축 코드(`:smile:` 등), Mermaid 다이어그램(인라인 SVG), LaTeX/수학(KaTeX/MathJax), GitHub 멘션 및 이슈 참조.

**전환:** **AS Notes: Toggle Inline Editor** 명령 또는 편집기 제목 표시줄의 눈 아이콘을 클릭. 전환 상태는 워크스페이스별로 유지됩니다.

**아웃라이너 모드 인식:** 아웃라이너 모드가 활성화되면, 글머리 기호 마커와 체크박스 구문이 아웃라이너 구조와 함께 인라인으로 스타일링됩니다(글머리 기호는 스타일링된 글머리 기호로, 체크박스는 글머리 기호와 체크박스 그래픽으로 렌더링).

| 설정 | 기본값 | 설명 |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | 인라인 렌더링 활성화/비활성화 |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | 고스트 상태 구문 문자의 투명도 |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | 단일 클릭으로 링크 열기 (Ctrl+Click 대신) |

인라인 편집기 설정의 전체 목록은 [설정](#설정)을 참조하세요.

### 템플릿 (Pro)

전용 템플릿 폴더(기본값: `templates/`)에 마크다운 파일로 재사용 가능한 노트 템플릿을 만듭니다. `/Template` 슬래시 명령으로 어디서나 삽입 가능.

**설정:** 워크스페이스 초기화 시 템플릿이 자동으로 생성됩니다. 일일 저널 항목용 기본 `Journal.md` 템플릿이 포함됩니다.

**템플릿 만들기:** 템플릿 폴더에 `.md` 파일을 추가합니다. 하위 디렉토리가 지원되며, 하위 폴더의 템플릿은 선택기에서 `folder/name`으로 표시됩니다.

**템플릿 삽입:** 마크다운 파일에서 `/`를 입력하고 **Template**을 선택한 후 목록에서 선택합니다. 템플릿 내용은 모든 플레이스홀더가 교체된 상태로 커서 위치에 삽입됩니다.

**플레이스홀더:**

| 플레이스홀더        | 설명                                                    | 예시                               |
|--------------------|----------------------------------------------------------------|---------------------------------------|
| `{{date}}`         | 현재 날짜 (YYYY-MM-DD)                                      | `2026-03-18`                          |
| `{{time}}`         | 현재 시간 (HH:mm:ss)                                        | `14:30:45`                            |
| `{{datetime}}`     | 전체 날짜 및 시간 (YYYY-MM-DD HH:mm:ss)                       | `2026-03-18 14:30:45`                 |
| `{{filename}}`     | 확장자 없는 현재 파일 이름                            | `My Page`                             |
| `{{title}}`        | `{{filename}}`의 별칭                                       | `My Page`                             |
| `{{cursor}}`       | 삽입 후 커서 위치                                | *(커서가 여기에)*                 |
| 사용자 정의 날짜 형식 | `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` 토큰의 조합 | `{{DD/MM/YYYY}}`가 `18/03/2026`으로 |

템플릿에서 리터럴 `{{date}}`를 출력하려면 백슬래시로 이스케이프: `\{{date}}`.

**저널 템플릿:** 템플릿 폴더의 `Journal.md` 파일이 새 일일 저널 항목의 템플릿으로 사용됩니다. 편집하여 향후 저널 페이지를 사용자 정의하세요.

### 테이블 명령

슬래시 명령 메뉴(`/`)의 모든 테이블 작업은 Pro 기능입니다. 무료 사용자는 **(Pro)**가 붙은 상태로 목록에 표시됩니다 - 보이지만 라이선스가 활성화될 때까지 차단됩니다.

테이블 명령의 전체 목록은 [슬래시 명령](#슬래시-명령)을 참조하세요.

### 암호화된 노트 (Pro)

Pro 사용자는 민감한 노트를 암호화된 파일에 저장할 수 있습니다. `.enc.md` 확장자를 가진 파일은 암호화된 노트로 취급됩니다 - 검색 인덱스에서 제외되며 확장 프로그램이 일반 텍스트로 읽지 않습니다.

**암호화 시작:**

1. 명령 팔레트에서 **AS Notes: Set Encryption Key**를 실행합니다. 암호는 OS 키체인(VS Code SecretStorage)에 안전하게 저장됩니다 - 디스크나 설정 파일에 기록되지 않습니다.
2. **AS Notes: Create Encrypted Note** (또는 날짜별 저널 항목의 경우 **AS Notes: Create Encrypted Journal Note**)로 암호화된 노트를 생성합니다.
3. 편집기에서 노트를 작성합니다. 잠그려면 **AS Notes: Encrypt [All|Current] Note(s)**를 실행 - 모든 일반 텍스트 `.enc.md` 파일이 제자리에서 암호화됩니다.
4. 노트를 읽으려면 **AS Notes: [All|Current] Note(s)**를 실행 - 저장된 암호를 사용하여 파일이 제자리에서 복호화됩니다.

**암호화 세부 사항:**

- 알고리즘: AES-256-GCM, 암호화마다 랜덤 12바이트 nonce
- 키 유도: PBKDF2-SHA256 (100,000회 반복), 암호에서
- 파일 형식: 단일 행 `ASNOTES_ENC_V1:<base64url payload>` 마커 - Git pre-commit hook을 통한 실수로 인한 커밋 방지에 사용.

**명령:**

- `AS Notes: Set Encryption Key` - 암호를 OS 키체인에 저장
- `AS Notes: Clear Encryption Key` - 저장된 암호 제거
- `AS Notes: Create Encrypted Note` - 노트 폴더에 새 `.enc.md` 파일 생성
- `AS Notes: Create Encrypted Journal Note` - 오늘의 저널 항목을 `.enc.md`로 생성
- `AS Notes: Encrypt All Notes` - 모든 일반 텍스트 `.enc.md` 파일 암호화
- `AS Notes: Decrypt All Notes` - 모든 암호화된 `.enc.md` 파일 복호화
- `AS Notes: Encrypt Current Note` - 활성 `.enc.md` 파일 암호화 (저장되지 않은 편집기 내용 읽기)
- `AS Notes: Decrypt Current Note` - 활성 `.enc.md` 파일 복호화 (디스크에서 읽기)

### 아웃라이너 모드

**아웃라이너 모드** (`as-notes.outlinerMode` 설정 또는 **AS Notes: Toggle Outliner Mode** 명령)를 활성화하여 편집기를 글머리 기호 우선 아웃라이너로 전환합니다. 모든 줄이 `-`로 시작하며 사용자 정의 키 바인딩으로 흐름을 유지합니다:

| 키 | 동작 |
|---|---|
| **Enter** | 같은 들여쓰기에 새 글머리 기호 삽입. TODO 줄(`- [ ]`)은 미체크 TODO로 계속. |
| **Tab** | 글머리 기호를 한 단계 들여쓰기 (위 글머리 기호보다 한 단계 깊은 것까지). |
| **Shift+Tab** | 글머리 기호를 한 단계 내어쓰기. |
| **Ctrl+Shift+Enter** | 순환: 일반 글머리 기호 → `- [ ]` → `- [x]` → 일반 글머리 기호. |
| **Ctrl+V / Cmd+V** | 다중 줄 붙여넣기: 클립보드의 각 줄이 별도의 글머리 기호로. |

## 시작하기

샘플 지식 베이스는 <https://github.com/appsoftwareltd/as-notes-demo-notes>를 클론하고 거기의 지침을 따라 초기화하세요.

### 워크스페이스 초기화

AS Notes는 워크스페이스 루트 또는 설정된 `rootDirectory` 하위 디렉토리에서 `.asnotes/` 디렉토리를 찾으면 활성화됩니다(`.git/`이나 `.obsidian/`과 유사). 없으면 확장 프로그램은 **수동 모드**로 실행됩니다 - 명령이 초기화를 안내하는 알림을 표시하고, 상태 표시줄이 설정을 안내합니다.

초기화하려면:

1. 명령 팔레트 열기 (`Ctrl+Shift+P`)
2. **AS Notes: Initialise Workspace** 실행

이것은 `.asnotes/` 디렉토리를 생성하고, 모든 마크다운 파일의 SQLite 인덱스를 구축하며, 모든 기능을 활성화합니다. 인덱스 파일(`.asnotes/index.db`)은 자동 생성된 `.gitignore`에 의해 Git에서 제외됩니다.

### 소스 코드와 함께 사용

AS Notes는 소프트웨어 프로젝트 내의 지식 베이스로 잘 작동합니다. 노트, 저널, 문서를 하위 디렉토리(예: `docs/` 또는 `notes/`)에 보관하고 나머지 저장소에는 소스 코드를 배치할 수 있습니다. 루트 디렉토리가 설정되면 모든 AS Notes 기능(위키 링크 강조, 자동 완성, 호버 툴팁, 슬래시 명령)이 해당 디렉토리로 범위가 제한됩니다. 워크스페이스 루트의 `README.md`와 같은 외부 마크다운 파일은 전혀 영향을 받지 않습니다.

초기화 중에 **Initialise Workspace** 명령이 위치를 선택하도록 요청합니다:

- **워크스페이스 루트** - 기본값, 전체 워크스페이스 사용
- **하위 디렉토리 선택** - 워크스페이스로 범위가 제한된 폴더 선택기 열기

선택한 경로는 `as-notes.rootDirectory` 워크스페이스 설정으로 저장됩니다. 설정하면 모든 AS Notes 데이터가 해당 디렉토리 내에 존재합니다: `.asnotes/`, `.asnotesignore`, 저널, 템플릿, 노트, 칸반 보드, 인덱스. 스캔, 파일 감시, 인덱싱은 이 디렉토리로 범위가 제한되므로 외부 파일은 영향을 받지 않습니다.

**Initialise Workspace**를 실행하기 전에 `as-notes.rootDirectory`가 이미 설정되어 있으면, 명령은 설정된 경로를 직접 사용합니다.

> **경고:** 초기화 후 `rootDirectory`를 변경하면, 노트 디렉토리(`.asnotes/` 포함)를 새 위치로 수동으로 이동하고 창을 다시 로드해야 합니다. 설정이 변경되면 확장 프로그램이 경고를 표시합니다.

### 인덱스 재구축

인덱스가 오래되었거나 손상된 경우, 명령 팔레트에서 **AS Notes: Rebuild Index**를 실행합니다. 진행 표시기와 함께 전체 인덱스를 삭제하고 다시 생성합니다.

### 워크스페이스 정리

확장 프로그램이 비정상 상태에 있는 경우(예: 충돌 후 지속적인 WASM 오류), 명령 팔레트에서 **AS Notes: Clean Workspace**를 실행합니다. 이렇게 하면:

- `.asnotes/` 디렉토리 제거 (인덱스 데이터베이스, 로그, Git hook 설정)
- 모든 메모리 내 상태 해제 및 수동 모드로 전환

AS Notes 루트의 `.asnotesignore`는 의도적으로 보존됩니다. 이후 **AS Notes: Initialise Workspace**를 실행하여 새로 시작하세요.

### 인덱스에서 파일 제외

AS Notes가 워크스페이스를 초기화하면 AS Notes 루트 디렉토리에 `.asnotesignore` 파일이 생성됩니다. 이 파일은 [`.gitignore` 패턴 구문](https://git-scm.com/docs/gitignore)을 사용하며, AS Notes 인덱스에서 제외되는 파일과 디렉토리를 제어합니다.

**기본 내용:**

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

선행 `/`가 없는 패턴은 모든 깊이에서 매칭됩니다 - `logseq/`는 `logseq/pages/foo.md`와 `vaults/work/logseq/pages/foo.md`를 동등하게 제외합니다. `/` 접두사로 AS Notes 루트에만 패턴을 고정합니다(예: `/logseq/`).

언제든지 `.asnotesignore`를 편집하세요. AS Notes가 파일을 감시하고 변경 시 자동으로 인덱스를 재스캔합니다 - 새로 무시된 파일은 인덱스에서 제거되고, 무시 해제된 파일이 추가됩니다.

> **참고:** `.asnotesignore`는 사용자가 편집 가능하고 버전 관리되는 파일입니다. AS Notes는 초기 생성 후에 덮어쓰지 않습니다.

---

## 문제 해결

### 파일 동기화 도구 관리 하에서의 성능 저하

일부 동기화 도구(예: MS OneDrive, Google Drive, Dropbox 등)로 디렉토리가 관리될 때 VS Code 편집기가 느리게 느껴질 수 있는 것이 관찰되었습니다.

AS Notes 디렉토리는 동기화로 관리할 수 있지만, 동기화 도구처럼 파일을 감시하지 않고 완전한 충돌 해결 기능을 가진 Git 사용을 권장합니다.

### "이 파일은 아직 인덱스되지 않았습니다"

현재 파일이 AS Notes 인덱스에 없을 때 백링크 패널에 이 메시지가 표시됩니다. 일반적인 원인:

- **VS Code `files.exclude` / `search.exclude` 설정** - AS Notes는 `vscode.workspace.findFiles()`를 사용하여 마크다운 파일을 검색하며, 이는 VS Code 설정을 따릅니다. 제외된 폴더의 파일(예: `logseq/version-files/`)은 스캔에서 자동으로 제외되어 인덱스되지 않습니다. 인덱스되어야 할 파일이 누락된 경우 **Settings -> Files: Exclude** 및 **Settings -> Search: Exclude**를 확인하세요.
- **`.asnotesignore` 패턴** - AS Notes 루트의 `.asnotesignore` 패턴과 일치하는 파일은 인덱스에서 제외됩니다. 위의 [인덱스에서 파일 제외](#인덱스에서-파일-제외)를 참조하세요.
- **파일이 아직 저장되지 않음** - 새로운 미저장 파일은 처음으로 디스크에 저장될 때까지 인덱스되지 않습니다.

해결하려면 워크스페이스 설정과 `.asnotesignore` 파일을 확인하세요. 파일이 인덱스되어야 한다면, 제외 패턴에 일치하지 않는지 확인한 후 명령 팔레트에서 **AS Notes: Rebuild Index**를 실행하세요.

## 개발

저장소는 세 개의 패키지로 구성된 monorepo입니다:

| 패키지 | 설명 |
|---|---|
| `common/` | 공유 위키 링크 파싱 라이브러리 (`Wikilink`, `WikilinkService`, `MarkdownItWikilinkPlugin`) |
| `vs-code-extension/` | VS Code 확장 프로그램 |
| `publish/` | AS Notes 노트북(마크다운 + 위키 링크)을 정적 HTML로 변환하는 CLI 유틸리티 |

문서 소스는 `docs-src/`(AS Notes 워크스페이스)에 있습니다. `publish` 도구가 이를 `docs/`로 변환합니다.

### VS Code 확장 프로그램

```bash
cd vs-code-extension
npm install
npm run build    # 확장 프로그램 빌드
npm run watch    # 감시 모드 (변경 시 재빌드)
npm test         # 단위 테스트 실행
npm run lint     # 타입 검사
```

### AS Notes에서 HTML로 게시 (HTML 변환)

변환기는 npm 패키지로 게시됩니다:

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

전체 문서는 [정적 사이트 게시](https://docs.asnotes.io/publishing-a-static-site.html)를 참조하세요.

### 디버깅

VS Code에서 **F5**를 눌러 확장 프로그램이 로드된 확장 프로그램 개발 호스트를 시작합니다.

디버그 버전은 Marketplace 설치보다 우선하므로 둘 다 공존할 수 있습니다.

VS Code는 확장 프로그램 개발 호스트에서 마지막으로 열었던 폴더를 기억합니다. [데모 지식 베이스](https://github.com/appsoftwareltd/as-notes-demo-notes)는 일반적인 사용 시나리오를 다루도록 설계되었습니다.

### 테스트

단위 테스트는 [vitest](https://vitest.dev/)를 사용하며, 위키 링크 파서, 오프셋 기반 조회, 세그먼트 계산, 인덱스 서비스 CRUD, 제목 추출, 이름 변경 감지 데이터 흐름, 중첩 링크 인덱싱을 다룹니다. `npm test`로 실행합니다.

### 퍼블리싱

릴리스는 VS Code Marketplace에 수동으로 게시되고, 버전 태그가 푸시되면 GitHub Release가 자동으로 생성됩니다.

**1단계 - 버전 업데이트**

`package.json`의 `version`을 업데이트하고 `CHANGELOG.md`에 항목을 추가합니다.

**2단계 - VS Code Marketplace에 게시**

```bash
cd .\vs-code-extension\
npm run build
npx @vscode/vsce package
npx @vscode/vsce login appsoftwareltd   # 인증이 만료된 경우 PAT 토큰 입력
npx @vscode/vsce publish
```

**3단계 - 태그 및 푸시**

```bash
cd ..
git add .
git commit -m "Release v2.3.2"   # 버전 변경
git tag v2.3.2                   # 버전 변경
git push origin main --tags
```

태그 푸시는 [Release 워크플로](.github/workflows/release.yml)를 트리거하여, 자동 생성된 릴리스 노트와 VS Code Marketplace 설치 링크가 포함된 GitHub Release를 자동으로 생성합니다.

### npm CLI(`asnotes-publish`) 게시

**1단계 - 버전 업데이트**

`publish/package.json`의 `version`을 업데이트합니다.

**2단계 - 빌드 및 게시**

```bash
cd publish
npm run build
npm login
npm publish
```

**3단계 - 확인**

```bash
npx asnotes-publish --help
```

## Agent Skills

AS Notes용 [agent skill](https://skills.sh/)을 사용할 수 있습니다. 설치하면 AI 비서(GitHub Copilot, Claude 등)에에 확장 프로그램의 전체 지식 - 위키 링크 구문, 명령, 설정, 키보드 단축키 등을 제공할 수 있습니다.

```bash
npx skills add appsoftwareltd/as-notes/skills/as-notes-agent-use
```

설치 후, AI 비서가 AS Notes에 대한 질문에 답하고, 설정 구성을 도우며, 기능을 설명하고, 노트 워크플로를 지원할 수 있습니다.

## 면책 조항

이 소프트웨어는 명시적이든 묵시적이든 어떠한 종류의 보증 없이 "있는 그대로" 제공됩니다. 저자와 기여자는 이 확장 프로그램의 사용 또는 오용으로 인한 데이터, 파일 또는 시스템의 손실, 손상에 대해 어떠한 책임도 지지 않습니다. 여기에는 워크스페이스의 파일을 생성, 이름 변경, 이동 또는 수정하는 작업이 포함되지만 이에 국한되지 않습니다.

**데이터 백업을 유지하는 것은 사용자의 책임입니다.** 이 확장 프로그램으로 관리하는 노트나 파일에 대해 버전 관리(예: Git) 또는 다른 백업 전략을 사용하는 것을 강력히 권장합니다.

이 확장 프로그램은 [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](LICENSE)에 따라 라이선스됩니다.

출처를 표시하면 **비상업적 목적**으로 자유롭게 사용, 공유, 수정할 수 있습니다. 상업적 사용에는 별도의 상업 라이선스가 필요합니다. 전체 조건은 [LICENSE](LICENSE)를 참조하거나 <https://www.appsoftware.com/contact>로 문의하세요.
