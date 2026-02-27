import { ChatAnthropic } from "@langchain/anthropic";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getDataSource, getAnthropicApiKey } from "./config";
import { getPatientSummary } from "./tools/get-patient-summary";
import { getMedications } from "./tools/get-medications";
import { drugInteractionCheck } from "./tools/drug-interaction-check";
import { allergyCheck } from "./tools/allergy-check";
import { getLabResults } from "./tools/lab-results";
import { getEncounterData } from "./tools/get-encounter-data";
import { reconcileMedications } from "./tools/reconcile-medications";
import { draftDischargeSummary } from "./tools/draft-discharge-summary";
import { saveToChart } from "./tools/save-to-chart";
import { generateDischargeInstructions } from "./tools/generate-discharge-instructions";
import { applyVerification } from "./verification/verification";
import { getErrorMessage } from "./utils/errors";

const AGENT_TIMEOUT_MS = 60_000;
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `You are a clinical query assistant for OpenEMR, a healthcare electronic health records system.

You help clinicians look up patient information, review medication lists, check vital signs, check for drug interactions, check allergy cross-reactivity, review lab results, prepare discharge summaries, generate patient discharge instructions, and perform medication reconciliation.

RULES:
- NEVER prescribe medications or recommend specific treatments
- NEVER diagnose conditions
- Always cite the data source (OpenEMR, OpenFDA, DailyMed) in your response
- If you find a serious drug interaction, prominently flag it as a safety concern
- If you find an allergy conflict, prominently flag it as a safety concern
- If you find critical lab values, prominently flag them
- If you don't have enough information, ask for clarification (e.g., ask for a patient ID)
- For medical emergencies, always recommend calling emergency services
- You are a data retrieval and safety checking tool, NOT a medical advisor
- When drafting a discharge summary, ALWAYS include: patient demographics, admission/discharge dates, admitting diagnosis, hospital course, discharge medications with changes, pending labs, and follow-up instructions
- When generating discharge instructions, use PLAIN LANGUAGE a patient can understand — avoid medical jargon, explain what each medication is for, clearly list what changed, include warning signs to watch for, and list scheduled follow-up appointments with dates, times, providers, and locations
- The discharge summary (draft_discharge_summary) is for CLINICIANS — use medical terminology. The discharge instructions (generate_discharge_instructions) are for PATIENTS — use layman's terms.
- When performing medication reconciliation, clearly categorize medications as: continued unchanged, modified (show old vs new dose), newly added, or discontinued
- When saving to chart, ALWAYS note that it is a DRAFT requiring clinician review
- NEVER finalize a document — only save drafts that require human review
- If a user asks for a discharge summary or discharge instructions without specifying an encounter ID, first call get_encounter_data to find the encounter, then use the encounter_id

You have access to these tools:
- get_patient_summary: Look up patient demographics, conditions, medications, allergies, and vital signs
- get_medications: Get detailed medication list for a patient
- drug_interaction_check: Check for known interactions between medications
- allergy_check: Check if a proposed medication conflicts with patient allergies
- get_lab_results: Get recent lab results for a patient with flagged abnormal/critical values
- get_encounter_data: Look up encounter/admission data including hospital course and diagnoses
- reconcile_medications: Compare pre-admission vs. discharge medications for a specific encounter
- draft_discharge_summary: Gather all data to draft a discharge summary for an encounter (clinician-facing, medical terminology)
- generate_discharge_instructions: Generate patient-friendly discharge instructions in plain language with medication changes, warning signs, follow-up guidance, drug education from DailyMed, and scheduled follow-up appointments (patient-facing, layman's terms)
- save_to_chart: Save a drafted document to the patient's chart as a draft (requires clinician review)`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_PROMPT],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

function createAgentExecutor() {
  const dataSource = getDataSource();
  const tools = [
    getPatientSummary(dataSource),
    getMedications(dataSource),
    drugInteractionCheck(),
    allergyCheck(dataSource),
    getLabResults(dataSource),
    getEncounterData(dataSource),
    reconcileMedications(dataSource),
    draftDischargeSummary(dataSource),
    generateDischargeInstructions(dataSource),
    saveToChart(dataSource),
  ];

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0,
    anthropicApiKey: getAnthropicApiKey(),
  });

  const agent = createToolCallingAgent({ llm, tools, prompt });
  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
    maxIterations: 10,
  });
}

let executor: AgentExecutor | null = null;

export function getExecutor(): AgentExecutor {
  if (!executor) {
    executor = createAgentExecutor();
  }
  return executor;
}

export function resetExecutor(): void {
  executor = null;
}

export interface ChatResult {
  response: string;
  toolCalls: Array<{ name: string; args: unknown; result?: string }>;
  safetyAlerts: string[];
}

export async function chat(
  message: string,
  sessionId: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  callbacks?: unknown[]
): Promise<ChatResult> {
  // Cap history to prevent context overflow
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  const chatHistory = recentHistory.flatMap((h) =>
    h.role === "user"
      ? [new HumanMessage(h.content)]
      : [new AIMessage(h.content)]
  );

  const exec = getExecutor();
  const config: { callbacks?: unknown[] } = {};
  if (callbacks && callbacks.length > 0) {
    config.callbacks = callbacks;
  }

  try {
    const resultPromise = exec.invoke(
      {
        input: message,
        chat_history: chatHistory,
      },
      config
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent timed out after ${AGENT_TIMEOUT_MS / 1000} seconds`)), AGENT_TIMEOUT_MS)
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);

    const toolCalls: Array<{ name: string; args: unknown; result?: string }> = [];
    const intermediateSteps = result.intermediateSteps || [];

    for (const step of intermediateSteps) {
      if (step.action?.tool) {
        toolCalls.push({
          name: step.action.tool,
          args: step.action.toolInput,
          result: step.observation?.toString?.(),
        });
      }
    }

    const rawOutput = result.output ?? "";
    let output: string;
    if (typeof rawOutput === "string") {
      output = rawOutput;
    } else if (Array.isArray(rawOutput)) {
      // Claude may return content blocks: [{type:"text", text:"..."}]
      output = rawOutput
        .filter((block: { type?: string }) => block.type === "text")
        .map((block: { text?: string }) => block.text || "")
        .join("\n");
    } else {
      output = String(rawOutput);
    }
    const verification = applyVerification(output, toolCalls);

    // Mutate history so callers can track conversation
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: verification.response });

    return {
      response: verification.response,
      toolCalls: verification.toolCalls,
      safetyAlerts: verification.safetyAlerts,
    };
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error(`Agent error [${sessionId}]:`, errorMessage);

    const verification = applyVerification(
      `I encountered an error processing your request: ${errorMessage}. Please try again.`,
      []
    );

    return {
      response: verification.response,
      toolCalls: [],
      safetyAlerts: verification.safetyAlerts,
    };
  }
}
