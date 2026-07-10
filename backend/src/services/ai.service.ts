import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export interface CRMLead {
  created_at: string;
  name: string;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE';
  crm_note: string | null;
  data_source: 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots' | null;
  possession_time: string | null;
  description: string | null;
}

export interface ProcessingResult {
  mapped: CRMLead[];
  skipped: {
    row: any;
    index: number;
    reason: string;
  }[];
}

export class AIService {
  private static getProvider(): 'gemini' | 'openai' | 'fallback' {
    const provider = process.env.LLM_PROVIDER?.toLowerCase() || 'gemini';
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (provider === 'gemini' && hasGemini) return 'gemini';
    if (provider === 'openai' && hasOpenAI) return 'openai';
    if (hasGemini) return 'gemini';
    if (hasOpenAI) return 'openai';
    return 'fallback';
  }

  /**
   * Processes a batch of raw records using the selected LLM or local fallback.
   */
  public static async processBatch(records: any[], batchStartIndex: number): Promise<ProcessingResult> {
    const provider = this.getProvider();
    console.log(`Processing batch starting at index ${batchStartIndex} with provider: ${provider}`);

    if (provider === 'gemini') {
      return this.processWithGemini(records, batchStartIndex);
    } else if (provider === 'openai') {
      return this.processWithOpenAI(records, batchStartIndex);
    } else {
      return this.processWithFallback(records, batchStartIndex);
    }
  }

  /**
   * Google Gemini API Integration
   */
  private static async processWithGemini(records: any[], batchStartIndex: number): Promise<ProcessingResult> {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash for speed and lower cost
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: this.getGeminiSchema()
      }
    });

    const prompt = this.getSystemPrompt() + `\n\nHere are the raw records to process (JSON array):\n${JSON.stringify(records, null, 2)}`;

    try {
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      const parsedJSON = JSON.parse(text);
      return this.validateAndNormalizeLLMResponse(records, parsedJSON.leads || [], batchStartIndex);
    } catch (error: any) {
      console.error('Gemini API error, falling back to local mapper:', error.message);
      return this.processWithFallback(records, batchStartIndex);
    }
  }

  /**
   * OpenAI API Integration
   */
  private static async processWithOpenAI(records: any[], batchStartIndex: number): Promise<ProcessingResult> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = this.getSystemPrompt() + `\n\nHere are the raw records to process (JSON array):\n${JSON.stringify(records, null, 2)}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content || '{}';
      const parsedJSON = JSON.parse(text);
      return this.validateAndNormalizeLLMResponse(records, parsedJSON.leads || [], batchStartIndex);
    } catch (error: any) {
      console.error('OpenAI API error, falling back to local mapper:', error.message);
      return this.processWithFallback(records, batchStartIndex);
    }
  }

  /**
   * Local regex-based heuristic mapping for key-less testing
   */
  private static processWithFallback(records: any[], batchStartIndex: number): ProcessingResult {
    const mapped: CRMLead[] = [];
    const skipped: ProcessingResult['skipped'] = [];

    records.forEach((row, index) => {
      const globalIndex = batchStartIndex + index;
      const keys = Object.keys(row);

      let name = '';
      let email: string | null = null;
      let phone: string | null = null;
      let company: string | null = null;
      let city: string | null = null;
      let state: string | null = null;
      let country: string | null = null;
      let createdAt: string = new Date().toISOString().replace('T', ' ').substring(0, 19);
      let status: CRMLead['crm_status'] = 'GOOD_LEAD_FOLLOW_UP';
      let dataSource: CRMLead['data_source'] = null;
      let possessionTime: string | null = null;
      let description: string | null = null;
      const extraNotes: string[] = [];

      // Look at all properties in the row to perform heuristic regex matching
      for (const key of keys) {
        const lowerKey = key.toLowerCase();
        const value = row[key] ? String(row[key]).trim() : '';

        if (!value) continue;

        if (lowerKey.includes('name') || lowerKey === 'fullname' || lowerKey === 'lead') {
          if (!name) name = value;
          else name += ' ' + value;
        } else if (lowerKey.includes('email') || lowerKey === 'mail') {
          if (!email) email = value;
          else extraNotes.push(`Extra email: ${value}`);
        } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact') || lowerKey.includes('tel') || lowerKey.includes('number')) {
          if (!phone) phone = value;
          else extraNotes.push(`Extra phone: ${value}`);
        } else if (lowerKey.includes('company') || lowerKey === 'org' || lowerKey === 'firm') {
          company = value;
        } else if (lowerKey.includes('city') || lowerKey === 'town') {
          city = value;
        } else if (lowerKey.includes('state') || lowerKey === 'region') {
          state = value;
        } else if (lowerKey.includes('country')) {
          country = value;
        } else if (lowerKey.includes('date') || lowerKey.includes('time') || lowerKey.includes('created')) {
          createdAt = value;
        } else if (lowerKey.includes('status') || lowerKey.includes('stage')) {
          const valLower = value.toLowerCase();
          if (valLower.includes('connect') || valLower.includes('busy') || valLower.includes('no answer')) {
            status = 'DID_NOT_CONNECT';
          } else if (valLower.includes('bad') || valLower.includes('not interest') || valLower.includes('junk')) {
            status = 'BAD_LEAD';
          } else if (valLower.includes('sale') || valLower.includes('done') || valLower.includes('won') || valLower.includes('close')) {
            status = 'SALE_DONE';
          } else {
            status = 'GOOD_LEAD_FOLLOW_UP';
          }
        } else if (lowerKey.includes('source')) {
          const valLower = value.toLowerCase().replace(/[\s_-]/g, '');
          if (valLower.includes('demand')) dataSource = 'leads_on_demand';
          else if (valLower.includes('meridian')) dataSource = 'meridian_tower';
          else if (valLower.includes('eden')) dataSource = 'eden_park';
          else if (valLower.includes('varah')) dataSource = 'varah_swamy';
          else if (valLower.includes('sarjapur')) dataSource = 'sarjapur_plots';
        } else if (lowerKey.includes('possession')) {
          possessionTime = value;
        } else if (lowerKey.includes('desc') || lowerKey.includes('about')) {
          description = value;
        } else {
          extraNotes.push(`${key}: ${value}`);
        }
      }

      // Split phone into country code and mobile number
      let countryCode: string | null = null;
      let mobileWithoutCountryCode: string | null = null;
      if (phone) {
        // Strip non-numeric and non-plus characters
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        if (cleanPhone.startsWith('+')) {
          // Extract country code (first 2-3 digits after +)
          if (cleanPhone.startsWith('+91')) {
            countryCode = '+91';
            mobileWithoutCountryCode = cleanPhone.substring(3);
          } else if (cleanPhone.startsWith('+1')) {
            countryCode = '+1';
            mobileWithoutCountryCode = cleanPhone.substring(2);
          } else {
            // Generic extraction (take first 3 chars as country code, or split)
            countryCode = cleanPhone.substring(0, 3);
            mobileWithoutCountryCode = cleanPhone.substring(3);
          }
        } else if (cleanPhone.length > 10) {
          // If no plus, but long, e.g. 919876543210
          if (cleanPhone.startsWith('91')) {
            countryCode = '+91';
            mobileWithoutCountryCode = cleanPhone.substring(2);
          } else {
            countryCode = null;
            mobileWithoutCountryCode = cleanPhone;
          }
        } else {
          countryCode = null;
          mobileWithoutCountryCode = cleanPhone;
        }
      }

      // Check if skipped
      if (!email && !mobileWithoutCountryCode) {
        skipped.push({
          row,
          index: globalIndex,
          reason: 'Record lacks both email and mobile number'
        });
        return;
      }

      // Ensure created_at is valid
      let finalCreatedAt = createdAt;
      try {
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) {
          finalCreatedAt = new Date().toISOString();
        }
      } catch {
        finalCreatedAt = new Date().toISOString();
      }

      mapped.push({
        created_at: finalCreatedAt,
        name: name || 'Unknown Lead',
        email,
        country_code: countryCode,
        mobile_without_country_code: mobileWithoutCountryCode,
        company,
        city,
        state,
        country,
        lead_owner: 'system@groweasy.com',
        crm_status: status,
        crm_note: extraNotes.length > 0 ? extraNotes.join(', ') : null,
        data_source: dataSource,
        possession_time: possessionTime,
        description
      });
    });

    return { mapped, skipped };
  }

  /**
   * Helper: Validates and normalizes JSON returned by the LLM
   */
  private static validateAndNormalizeLLMResponse(
    originalRecords: any[],
    llmLeads: any[],
    batchStartIndex: number
  ): ProcessingResult {
    const mapped: CRMLead[] = [];
    const skipped: ProcessingResult['skipped'] = [];

    originalRecords.forEach((originalRow, index) => {
      const globalIndex = batchStartIndex + index;
      const llmMatch = llmLeads[index];

      if (!llmMatch) {
        skipped.push({
          row: originalRow,
          index: globalIndex,
          reason: 'AI did not return output for this row'
        });
        return;
      }

      // Extract details
      const email = llmMatch.email ? String(llmMatch.email).trim() : null;
      const mobile = llmMatch.mobile_without_country_code ? String(llmMatch.mobile_without_country_code).trim() : null;

      // Skip criteria check
      if (!email && !mobile) {
        skipped.push({
          row: originalRow,
          index: globalIndex,
          reason: 'Skipped: contains neither email nor mobile number'
        });
        return;
      }

      // Validate date
      let createdAt = llmMatch.created_at || new Date().toISOString();
      try {
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) {
          createdAt = new Date().toISOString();
        }
      } catch {
        createdAt = new Date().toISOString();
      }

      // Validate Status
      const statusOptions = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
      let status = llmMatch.crm_status || 'GOOD_LEAD_FOLLOW_UP';
      if (!statusOptions.includes(status)) {
        status = 'GOOD_LEAD_FOLLOW_UP';
      }

      // Validate DataSource
      const sourceOptions = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];
      let dataSource = llmMatch.data_source || null;
      if (dataSource && !sourceOptions.includes(dataSource)) {
        dataSource = null;
      }

      mapped.push({
        created_at: createdAt,
        name: llmMatch.name || 'Unknown Lead',
        email,
        country_code: llmMatch.country_code || null,
        mobile_without_country_code: mobile,
        company: llmMatch.company || null,
        city: llmMatch.city || null,
        state: llmMatch.state || null,
        country: llmMatch.country || null,
        lead_owner: llmMatch.lead_owner || 'system@groweasy.com',
        crm_status: status as any,
        crm_note: llmMatch.crm_note || null,
        data_source: dataSource as any,
        possession_time: llmMatch.possession_time || null,
        description: llmMatch.description || null
      });
    });

    return { mapped, skipped };
  }

  /**
   * Generates the system prompt to guide LLM column mapping
   */
  private static getSystemPrompt(): string {
    return `You are an expert CRM Data Integration engine. Your task is to map raw data records (given in JSON format) into the GrowEasy CRM schema.
    
Analyze the input records carefully. The column headers in the CSV were arbitrary, and you must use semantic meaning to map them.

Map the columns into the following GrowEasy CRM schema structure:
1. "created_at": Date when lead was created. Must be in a format that javascript's new Date(created_at) can parse successfully (e.g. YYYY-MM-DD HH:mm:ss). If unparseable or absent, default to the current time.
2. "name": The lead's full name. If split across multiple columns (like First Name, Last Name), merge them.
3. "email": Primary email. If multiple email addresses are found, use the first one, and append the remaining emails to "crm_note".
4. "country_code": Country dialing code (e.g., +91, +1). If prefixing the mobile number, extract it.
5. "mobile_without_country_code": Mobile number. Exclude country code. If multiple phone numbers are found, use the first, and append the remaining numbers to "crm_note".
6. "company": Company/business name.
7. "city": City.
8. "state": State.
9. "country": Country.
10. "lead_owner": Owner of lead.
11. "crm_status": Lead status. MUST be exactly one of: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE. Deduce from remarks/status column. Defaults to GOOD_LEAD_FOLLOW_UP.
12. "crm_note": Gather remarks, follow-up logs, extra emails, extra phone numbers, and any other relevant fields that do not fit into the standard CRM fields.
13. "data_source": Must match exactly one of: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots. If not confident, leave it null.
14. "possession_time": Target property possession time if mentioned.
15. "description": Extra description/details.

CRITICAL RULES:
- Return a JSON object with a key "leads" containing an array of mapped objects.
- Keep the exact array length matching the input records. Output the mapped objects in the same order as input.
- Do NOT perform skipping yourself by omitting entries. For records that are invalid (lacking both email and phone number), fill the fields as null, and our backend validation will skip them.
- Ensure all output strings do not contain raw line breaks that break JSON parsing (use \\n).`;
  }

  /**
   * Structured Schema definition for Gemini JSON mode
   */
  private static getGeminiSchema(): any {
    return {
      type: 'OBJECT',
      properties: {
        leads: {
          type: 'ARRAY',
          description: 'List of mapped CRM leads, one for each input record in exact order.',
          items: {
            type: 'OBJECT',
            properties: {
              created_at: { type: 'STRING', description: 'Parseable date string e.g. YYYY-MM-DD HH:mm:ss' },
              name: { type: 'STRING', description: 'Full name' },
              email: { type: 'STRING', description: 'Primary email address or null' },
              country_code: { type: 'STRING', description: 'Country dial code, e.g. +91' },
              mobile_without_country_code: { type: 'STRING', description: 'Mobile digits without country code' },
              company: { type: 'STRING', description: 'Company name' },
              city: { type: 'STRING', description: 'City' },
              state: { type: 'STRING', description: 'State' },
              country: { type: 'STRING', description: 'Country' },
              lead_owner: { type: 'STRING', description: 'Lead owner email/name' },
              crm_status: { 
                type: 'STRING', 
                description: 'Must be one of: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE' 
              },
              crm_note: { type: 'STRING', description: 'Notes, remarks, overflow numbers/emails' },
              data_source: { 
                type: 'STRING', 
                description: 'Must be one of: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots or null' 
              },
              possession_time: { type: 'STRING', description: 'Possession time' },
              description: { type: 'STRING', description: 'Additional description' }
            },
            required: ['created_at', 'name', 'crm_status']
          }
        }
      },
      required: ['leads']
    };
  }
}
