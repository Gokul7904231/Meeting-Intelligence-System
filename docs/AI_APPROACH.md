# AI Analysis & Citation Grounding Approach - AI_APPROACH.md

This document outlines the prompt engineering, grounding strategy, hallucination prevention, validation pipelines, and limitations of the Hintro Meeting Intelligence engine.

---

## 📝 1. Prompt Design & Output Formatting
To call the Gemini 1.5 Flash API asynchronously, we bypass heavy orchestrator layers (such as LangChain) and communicate directly with the REST endpoints via `httpx`. The prompts are configured as follows:

* **System Instruction Prompt**:
  Forces the model to act as a strict meeting analytics parser. It defines the structured response mapping schema and mandates citation grounding.
* **MIME-Type Constraints**:
  We supply `"generationConfig": {"responseMimeType": "application/json"}` in the Gemini request configuration. This instructs the model to construct raw outputs conforming strictly to standard JSON.

---

## 📍 2. Citation Strategy & Timestamp Grounding
Every summary point, decision, action item, or follow-up task extracted by the model is bound to a `citations` array:
* The prompt instructs the model to scan the transcript dialogue logs and locate the exact string timestamp (e.g., `[00:30]`) associated with the speaker statement.
* These timestamps are extracted and mapped into the response:
  ```json
  "actionItems": [
    {
      "task": "Handle Docker configuration",
      "assignee": "Bob",
      "citations": ["01:20"]
    }
  ]
  ```
* On the UI layer, these citations render as interactive timestamps that smooth-scroll the Center Transcript Console to the referenced dialog block and flash it with a highlighting visual pulse.

---

## 🛡️ 3. Hallucination Prevention & Grounding
To prevent the model from inventing ("hallucinating") details, tasks, assignees, or dates not explicitly stated in the audio transcription text, we implement the following guardrails:

1. **System Restrictions**: The system prompt declares that any generated item lacking a corresponding citation timestamp in the transcript is invalid.
2. **Context Isolation**: The model is instructed to rely solely on the input transcript context. It is prohibited from generating insights using external databases or pre-trained knowledge.
3. **Pydantic Validation**: Responses are loaded directly into Pydantic validation structures (`MeetingAnalysisResult`). If the model fails to return standard citations or valid fields, the request raises a validation error.

---

## 🔄 4. Output Validation & Fail-Safe Fallbacks
If the Gemini API key is missing, or if the API call encounters a rate limit or HTTP failure, the application dynamically falls back to a **local rule-based parser** (`_fallback_parser`):
* It scans the transcript line by line for action terms (e.g., `"need to"`, `"will handle"`, `"todo"`) and assigns tasks to speakers.
* Scans for decisions (e.g., `"decide"`, `"agree"`) and follow-ups (e.g., `"follow up"`, `"schedule"`, `"meet again"`).
* Generates a structural `MeetingAnalysisResult` conforming to the same response schema, ensuring the React UI layer renders the items seamlessly without crashing.

---

## ⚠️ 5. Known Limitations
* **Transcript Formatting**: The local regex parser and citation scrolls rely on dialogue entries starting with `[MM:SS] Speaker: Phrase`. Transcripts missing this format default to `00:00` timestamps.
* **Local Parser Granularity**: The rule-based local parser performs lexical keyword checks. It cannot resolve context or summarize complex dialogue arguments.
