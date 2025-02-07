import { Telegraf } from 'telegraf';
import fs from 'fs';
import stringSimilarity from 'string-similarity';
import { GPT4All } from "gpt4all";

const knowledgeBaseFile = 'knowledgeBase.json';
const SIMILARITY_THRESHOLD = 0.3;

// Load knowledge base
function loadKnowledgeBase() {
    if (fs.existsSync(knowledgeBaseFile)) {
        return JSON.parse(fs.readFileSync(knowledgeBaseFile, 'utf8'));
    }
    return [];
}

// Save knowledge base
function saveKnowledgeBase(data) {
    fs.writeFileSync(knowledgeBaseFile, JSON.stringify(data, null, 2));
}

// Initialize GPT4All Model (Reuse Instance)
const gpt4all = new GPT4All("gpt4all-lora-quantized", {
    modelPath: "./models/gpt4all-lora-quantized.bin"
});

async function initGPT4All() {
    await gpt4all.init();
    await gpt4all.open();
}
initGPT4All();

async function fetchChatGPT4ALLResponse(userInput) {
    try {
        const response = await gpt4all.chat(userInput);
        return response || "Sorry, I couldn't generate a response.";
    } catch (error) {
        console.error("GPT4All error:", error);
        return "Error fetching AI response.";
    }
}

// Telegram Bot Setup
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.start((ctx) => ctx.reply('Welcome to Superteam Vietnam Bot!'));

const knowledgeBase = loadKnowledgeBase();

bot.on("text", async (ctx) => {
    const userQuery = ctx.message.text;
    const questions = knowledgeBase.map(item => item.question);
    const matches = stringSimilarity.findBestMatch(userQuery, questions);
    const bestMatch = matches.bestMatch;

    if (bestMatch.rating >= SIMILARITY_THRESHOLD) {
        const response = knowledgeBase.find(item => item.question === bestMatch.target);
        ctx.reply(response.answer);
    } else {
        const aiResponse = await fetchChatGPT4ALLResponse(userQuery);
        ctx.reply(aiResponse);
    }
});

bot.launch();

export { loadKnowledgeBase, saveKnowledgeBase };
