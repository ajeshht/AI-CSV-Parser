"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ai_service_1 = require("./services/ai.service");
const dotenv = __importStar(require("dotenv"));
// Load environmental variables
dotenv.config();
async function runTests() {
    console.log('==================================================');
    console.log('Running AI Service Mapping Tests...');
    console.log(`Current LLM Provider: ${process.env.LLM_PROVIDER || 'gemini'}`);
    console.log(`Gemini Key Configured: ${process.env.GEMINI_API_KEY ? 'YES' : 'NO'}`);
    console.log(`OpenAI Key Configured: ${process.env.OPENAI_API_KEY ? 'YES' : 'NO'}`);
    console.log('==================================================\n');
    // Test Case 1: Standard Leads
    const standardLeads = [
        {
            created_at: '2026-05-13 14:20:48',
            name: 'John Doe',
            email: 'john.doe@example.com',
            country_code: '+91',
            mobile_without_country_code: '9876543210',
            company: 'GrowEasy',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            lead_owner: 'test@gmail.com',
            crm_status: 'GOOD_LEAD_FOLLOW_UP',
            crm_note: 'Client is asking to reschedule demo',
            data_source: 'leads_on_demand',
            possession_time: '',
            description: ''
        }
    ];
    // Test Case 2: Messy Leads
    const messyLeads = [
        {
            Fname: 'Amit',
            Lname: 'Kumar',
            'Email ID': 'amit.kumar@gmail.com',
            'Contact Number': '+919888877777',
            'Firm Name': 'Kumar Group',
            Location: 'Chennai',
            Date: '12/04/2026',
            Remarks: 'Wants callback tomorrow afternoon. Alternate email is amit.k@outlook.com',
            'Ad Source': 'leads_on_demand'
        },
        {
            Fname: 'Emma',
            Lname: 'Watson',
            'Email ID': 'emma.w@yahoo.com',
            'Contact Number': '+15550192834',
            'Firm Name': 'Watson Films',
            Location: 'Los Angeles',
            Date: 'May 10 2026',
            Remarks: 'Wants to invest in Meridian properties',
            'Ad Source': 'meridian_tower'
        }
    ];
    // Test Case 3: Invalid Leads (lacking contact info)
    const invalidLeads = [
        {
            Name: 'Bob White',
            Company: 'White Enterprises',
            Notes: 'Has no email and no phone'
        },
        {
            Name: 'Charlie Black',
            Email: 'charlie@example.com',
            Company: 'Black Corp'
        }
    ];
    console.log('--- TEST 1: Standard Lead Processing ---');
    const res1 = await ai_service_1.AIService.processBatch(standardLeads, 0);
    console.log(`Mapped: ${res1.mapped.length}, Skipped: ${res1.skipped.length}`);
    console.log('First mapped lead:', JSON.stringify(res1.mapped[0], null, 2));
    console.log('\n');
    console.log('--- TEST 2: Messy Lead Processing (AI Mapping / Heuristic fallback) ---');
    const res2 = await ai_service_1.AIService.processBatch(messyLeads, 0);
    console.log(`Mapped: ${res2.mapped.length}, Skipped: ${res2.skipped.length}`);
    res2.mapped.forEach((lead, i) => {
        console.log(`Mapped Lead ${i + 1}: Name="${lead.name}", Email="${lead.email}", Code="${lead.country_code}", Mobile="${lead.mobile_without_country_code}", Notes="${lead.crm_note}"`);
    });
    console.log('\n');
    console.log('--- TEST 3: Invalid Lead Validation (Skip checks) ---');
    const res3 = await ai_service_1.AIService.processBatch(invalidLeads, 0);
    console.log(`Mapped: ${res3.mapped.length}, Skipped: ${res3.skipped.length}`);
    console.log('Skipped records details:');
    res3.skipped.forEach((skip) => {
        console.log(`Row Index ${skip.index + 1}: Reason="${skip.reason}"`);
    });
    console.log('Mapped records details:');
    res3.mapped.forEach((lead) => {
        console.log(`Mapped lead: Name="${lead.name}", Email="${lead.email}"`);
    });
    console.log('\n==================================================');
    console.log('Tests completed!');
}
runTests().catch((err) => {
    console.error('Test execution failed:', err);
});
