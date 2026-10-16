import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { AiToolsService } from "./ai-tools.service";
import { GoogleGenAI } from "@google/genai";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAIClient: GoogleGenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: AiToolsService,
  ) {
    this.initGeminiClient();
  }

  private initGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.genAIClient = new GoogleGenAI({ apiKey });
        this.logger.log("Google Gen AI client successfully initialized with GEMINI_API_KEY.");
      } catch (err: any) {
        this.logger.error(`Failed to initialize Google Gen AI: ${err.message}`);
      }
    } else {
      this.logger.warn("GEMINI_API_KEY is not defined in environment variables. AI queries will return setup instructions.");
    }
  }

  /**
   * Process a Chat Message from a Tenant Owner
   */
  async processChatMessage(
    tenantId: string,
    userId: string,
    userPrompt: string,
    conversationId?: string,
  ) {
    // 1. Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await this.prisma.aiConversation.findFirst({
        where: { id: conversationId, tenantId, userId },
      });
      if (!conversation) {
        throw new NotFoundException("Conversation not found");
      }
    } else {
      // Auto-title from the first few words of the prompt
      const title = userPrompt.length > 40 ? `${userPrompt.substring(0, 37)}...` : userPrompt;
      conversation = await this.prisma.aiConversation.create({
        data: {
          tenantId,
          userId,
          title,
        },
      });
    }

    // 2. Save User message to DB
    await this.prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: userPrompt,
      },
    });

    // 3. Fallback if GEMINI_API_KEY is not set
    if (!this.genAIClient) {
      this.initGeminiClient();
    }
    if (!this.genAIClient) {
      const fallbackText =
        "Google Gemini API key is missing. Please add `GEMINI_API_KEY=your_key_here` to your `backend/.env` file to enable AI answers and live tool calling.";
      const aiMsg = await this.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "model",
          content: fallbackText,
        },
      });
      return {
        conversationId: conversation.id,
        message: aiMsg,
        structuredCards: [],
      };
    }

    // 4. Load tenant context & settings
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });

    const salonName = tenant?.name ?? "Salon";
    const timezone = tenant?.settings?.timezone ?? "UTC";
    const currency = tenant?.settings?.currency ?? "INR";
    const currentDate = new Date().toISOString();

    const systemInstruction = `You are "Salon Copilot", an AI operational assistant built exclusively for the owner and management of "${salonName}".
Current System Date/Time: ${currentDate}.
Default Timezone: ${timezone}.
Default Currency: ${currency}.

Your responsibilities:
1. Provide accurate business metrics (revenue, appointment count, staff attendance, schedules).
2. Help book appointments when requested by gathering customer name, phone, service, time, and optional stylist.
3. Keep answers clear, professional, and well-structured with bullet points or summary tables.
4. When reporting revenue or money, format with currency: ${currency}.
5. When reporting times, format in 12-hour AM/PM format.
6. Always respect tenant privacy; never guess or assume data from outside this salon.`;

    // 5. Load past messages for conversation history (last 10 messages)
    const history = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    const contents: any[] = [];
    for (const msg of history) {
      contents.push({
        role: msg.role === "assistant" || msg.role === "model" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const executedTools: Array<{ name: string; args: any; result: any }> = [];
    const candidateModels = [
      process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      "gemini-3-flash-preview",
      "gemini-flash-lite-latest",
    ];

    let finalResponseText = "";
    let loopCount = 0;
    const maxLoops = 4;

    const generateWithFailover = async (payload: { contents: any[]; config: any }) => {
      let lastError: any = null;
      for (const m of candidateModels) {
        try {
          return await this.genAIClient!.models.generateContent({
            model: m,
            contents: payload.contents,
            config: payload.config,
          });
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || "";
          if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("429")) {
            this.logger.warn(`Model ${m} busy or unavailable (${msg.slice(0, 80)}). Retrying with backup model...`);
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    };

    try {
      while (loopCount < maxLoops) {
        loopCount++;

        const response: any = await generateWithFailover({
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: this.toolsService.getFunctionDeclarations() as any }],
            temperature: 0.2,
          },
        });

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          // Push model's turn (with function call parts)
          const modelTurnContent = response.candidates?.[0]?.content;
          if (modelTurnContent) {
            contents.push(modelTurnContent);
          }

          // Execute each requested tool
          const responseParts: any[] = [];
          for (const call of functionCalls) {
            const toolResult = await this.toolsService.executeTool(
              call.name,
              call.args,
              tenantId,
              userId,
            );

            const isDuplicate = executedTools.some(
              (t) => t.name === call.name && JSON.stringify(t.args) === JSON.stringify(call.args),
            );
            if (!isDuplicate) {
              executedTools.push({
                name: call.name,
                args: call.args,
                result: toolResult,
              });
            }

            responseParts.push({
              functionResponse: {
                name: call.name,
                response: { output: toolResult },
              },
            });
          }

          // Push tool response turn
          contents.push({
            role: "user",
            parts: responseParts,
          });

          // Continue loop to let Gemini generate the natural language summary
          continue;
        }

        // Final text answer received
        finalResponseText = response.text ?? "";
        break;
      }
    } catch (error: any) {
      this.logger.error(`Error during Gemini generation: ${error.message}`, error.stack);

      // 1. If tools were ALREADY executed before the error, summarize their data cleanly:
      if (executedTools.length > 0) {
        const lastTool = executedTools[executedTools.length - 1];
        if (lastTool.name === 'getStaffOnDuty') {
          finalResponseText = `Currently, there are **${lastTool.result.currentlyOnDuty} staff members on duty** today (${lastTool.result.date}).\n\n* **On Duty:** ${lastTool.result.currentlyOnDuty}\n* **On Leave:** ${lastTool.result.onLeave}\n* **Total Active Staff:** ${lastTool.result.totalActiveStaff}`;
        } else if (lastTool.name === 'getRevenueSummary') {
          finalResponseText = `Today's total recorded revenue is **₹${Number(lastTool.result.totalRevenue || 0).toLocaleString()}** across **${lastTool.result.invoiceCount || 0} paid invoices** and **${lastTool.result.appointmentsBooked || 0} appointments**.`;
        } else if (lastTool.name === 'getUpcomingAppointments') {
          finalResponseText = `Found **${lastTool.result.totalAppointments} appointment(s)** scheduled for ${lastTool.result.date}.`;
        } else if (lastTool.name === 'getSalonServices') {
          finalResponseText = `Here is your salon's services catalog with **${lastTool.result.totalServices} active service(s)**.`;
        } else {
          finalResponseText = "Here are the operational results from your salon records.";
        }
      } else {
        // 2. If Gemini failed on initial call (e.g. rate limit / quota exhaustion), try direct intent matching
        const lowerPrompt = userPrompt.toLowerCase();
        try {
          if (/(duty|who is on|working|attendance|available staff|stylist)/i.test(lowerPrompt)) {
            const toolResult = await this.toolsService.executeTool('getStaffOnDuty', {}, tenantId, userId);
            executedTools.push({ name: 'getStaffOnDuty', args: {}, result: toolResult });
            finalResponseText = `Currently, there are **${toolResult.currentlyOnDuty} staff members on duty** today (${toolResult.date}).\n\n* **On Duty:** ${toolResult.currentlyOnDuty}\n* **On Leave:** ${toolResult.onLeave}\n* **Total Active Staff:** ${toolResult.totalActiveStaff}`;
          } else if (/(revenue|sales|earnings|how much.*made|income|collection)/i.test(lowerPrompt)) {
            const toolResult = await this.toolsService.executeTool('getRevenueSummary', {}, tenantId, userId);
            executedTools.push({ name: 'getRevenueSummary', args: {}, result: toolResult });
            finalResponseText = `Today's total recorded revenue is **₹${Number(toolResult.totalRevenue || 0).toLocaleString()}** across **${toolResult.invoiceCount || 0} paid invoices** and **${toolResult.appointmentsBooked || 0} appointments**.`;
          } else if (/(appointment|booking|schedule|who is booked|client list)/i.test(lowerPrompt)) {
            const toolResult = await this.toolsService.executeTool('getUpcomingAppointments', {}, tenantId, userId);
            executedTools.push({ name: 'getUpcomingAppointments', args: {}, result: toolResult });
            finalResponseText = `You have **${toolResult.totalAppointments} appointment(s)** scheduled for today (${toolResult.date}).`;
          } else if (/(service|catalog|menu|price list|pricing|haircut)/i.test(lowerPrompt)) {
            const toolResult = await this.toolsService.executeTool('getSalonServices', {}, tenantId, userId);
            executedTools.push({ name: 'getSalonServices', args: {}, result: toolResult });
            finalResponseText = `Your salon offers **${toolResult.totalServices} active service(s)** across **${toolResult.categories?.length || 0} categories**.`;
          }
        } catch (toolErr: any) {
          this.logger.error(`Failed intent fallback tool execution: ${toolErr.message}`);
        }

        // If intent fallback didn't generate response, parse the error gracefully
        if (!finalResponseText) {
          const rawMsg = error?.message || '';
          if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('Quota exceeded')) {
            finalResponseText = 'Google Gemini free-tier rate limit was reached (max requests/min). Please wait 30 seconds and try again, or check your API quota.';
          } else if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
            finalResponseText = 'The AI model is experiencing temporary high demand. Please try asking again in a few moments.';
          } else {
            // Clean up any JSON blob if present
            try {
              const parsed = JSON.parse(rawMsg);
              finalResponseText = parsed.error?.message || 'The AI assistant encountered a temporary issue. Please try again.';
            } catch {
              finalResponseText = rawMsg.length > 150 ? 'AI service temporarily unavailable. Please try again in a moment.' : rawMsg;
            }
          }
        }
      }
    }

    if (!finalResponseText) {
      finalResponseText = "Here are the results based on your salon data.";
    }

    // 6. Save Model message to DB
    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "model",
        content: finalResponseText,
        toolCalls: executedTools.length > 0 ? (executedTools.map(t => ({ name: t.name, args: t.args })) as any) : undefined,
        toolResults: executedTools.length > 0 ? (executedTools.map(t => ({ name: t.name, result: t.result })) as any) : undefined,
      },
    });

    await this.prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      message: assistantMessage,
      structuredCards: executedTools,
    };
  }

  /**
   * Get all conversations for current tenant user
   */
  async getConversations(tenantId: string, userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  /**
   * Get conversation with messages
   */
  async getConversationMessages(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    await this.prisma.aiConversation.delete({
      where: { id: conversationId },
    });

    return { success: true };
  }
}
