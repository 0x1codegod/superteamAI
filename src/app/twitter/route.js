import { TwitterApi } from 'twitter-api-v2';
import { Telegraf } from 'telegraf';
import { GPT4All } from "gpt4all";

const bot = new Telegraf(process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN);
const twitterClient = new TwitterApi({
    appKey: process.env.NEXT_PUBLIC_TWITTER_API_KEY,
    appSecret: process.env.NEXT_PUBLIC_TWITTER_API_SECRET,
    accessToken: process.env.NEXT_PUBLIC_TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.NEXT_PUBLIC_TWITTER_ACCESS_SECRET,
});

// Initialize GPT4All
const gpt4all = new GPT4All("gpt4all-lora-quantized", {
    modelPath: "./models/gpt4all-lora-quantized.bin"
});

async function initGPT4All() {
    await gpt4all.init();
    await gpt4all.open();
}
initGPT4All();

// Generate Tweet using GPT4All
async function generateTweet(prompt) {
    try {
        const response = await gpt4all.chat(prompt);
        return response.trim() || "Sorry, couldn't generate a tweet.";
    } catch (error) {
        console.error("GPT4All Error:", error);
        return "Error generating tweet.";
    }
}

// Suggest Tweet Enhancements using GPT4All
async function suggestTweetEnhancements(draft) {
    try {
        const prompt = `Improve this tweet for better engagement: "${draft}"`;
        const response = await gpt4all.chat(prompt);
        return response.trim() || "Sorry, couldn't enhance the tweet.";
    } catch (error) {
        console.error("GPT4All Error:", error);
        return "Error enhancing tweet.";
    }
}

// Send Tweet for Approval via Telegram
async function sendTweetForApproval(tweet) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    await bot.telegram.sendMessage(adminChatId, `Approve this tweet: \n${tweet}`, {
        reply_markup: {
            inline_keyboard: [[
                { text: 'Approve', callback_data: `approve_${tweet}` },
                { text: 'Reject', callback_data: `reject_${tweet}` }
            ]]
        }
    });
}

// Handle Telegram Approvals
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData.startsWith('approve_')) {
        const tweet = callbackData.replace('approve_', '');
        try {
            await twitterClient.v2.tweet(tweet);
            ctx.reply('Tweet posted successfully!');
        } catch (error) {
            ctx.reply('Failed to post tweet');
        }
    } else if (callbackData.startsWith('reject_')) {
        ctx.reply('Tweet rejected.');
    }
    ctx.answerCbQuery();
});

export { generateTweet, suggestTweetEnhancements, sendTweetForApproval };
