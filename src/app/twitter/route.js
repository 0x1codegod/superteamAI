import { TwitterApi } from "twitter-api-v2";
import { Telegraf } from "telegraf";
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
  modelPath: "./models/gpt4all-lora-quantized.bin",
});

async function initGPT4All() {
  await gpt4all.init();
  await gpt4all.open();
  console.log("✅ GPT4All is ready!");
}
initGPT4All();

// Ensure GPT4All closes properly when the process exits
process.on("exit", async () => {
  console.log("🛑 Closing GPT4All...");
  await gpt4all.close();
});

// Fetch Twitter Followers
async function getMyFollowers() {
  try {
    const followers = await twitterClient.v2.followers("me", { max_results: 100 });
    return followers.data.map(user => user.username);
  } catch (error) {
    console.error("Error fetching followers:", error);
    return [];
  }
}

// Fetch Followed Accounts
async function getMyFollowedAccounts() {
  try {
    const following = await twitterClient.v2.following("me", { max_results: 100 });
    return following.data.map(user => user.username);
  } catch (error) {
    console.error("Error fetching followed accounts:", error);
    return [];
  }
}

// Generate Tweet using GPT4All
async function generateTweet(prompt) {
  try {
    await initGPT4All(); // Ensure GPT4All is ready
    let response = await gpt4all.chat(prompt);
    
    // Add mentions for better engagement
    const followers = await getMyFollowers();
    if (followers.length > 0) {
      const mentions = followers.slice(0, 3).map(user => `@${user}`).join(" ");
      response += `\n\n${mentions}`;
    }

    return response.trim() || "Sorry, couldn't generate a tweet.";
  } catch (error) {
    console.error("GPT4All Error:", error);
    return "Error generating tweet.";
  }
}

// Suggest Tweet Enhancements using GPT4All
async function suggestTweetEnhancements(draft) {
  try {
    await initGPT4All(); // Ensure GPT4All is ready
    const prompt = `Improve this tweet for better engagement: "${draft}"`;
    let response = await gpt4all.chat(prompt);

    // Add mentions for better engagement
    const followers = await getMyFollowers();
    if (followers.length > 0) {
      const mentions = followers.slice(0, 3).map(user => `@${user}`).join(" ");
      response += `\n\n${mentions}`;
    }

    return response.trim() || "Sorry, couldn't enhance the tweet.";
  } catch (error) {
    console.error("GPT4All Error:", error);
    return "Error enhancing tweet.";
  }
}

// Store pending tweets for approval
const pendingTweets = new Map();

// Send Tweet for Approval via Telegram
async function sendTweetForApproval(tweet) {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const tweetId = Date.now().toString(); // Generate unique ID for each tweet
  pendingTweets.set(tweetId, tweet); // Store tweet for reference

  await bot.telegram.sendMessage(adminChatId, `Approve this tweet: \n${tweet}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Approve", callback_data: `approve_${tweetId}` }],
        [{ text: "Reject", callback_data: `reject_${tweetId}` }],
      ],
    },
  });
}

// Handle Telegram Approvals
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const [action, tweetId] = callbackData.split("_");

  if (pendingTweets.has(tweetId)) {
    const tweet = pendingTweets.get(tweetId);
    pendingTweets.delete(tweetId); // Remove after processing

    if (action === "approve") {
      try {
        await twitterClient.v2.tweet(tweet);
        ctx.reply("✅ Tweet posted successfully!");
      } catch (error) {
        console.error("Twitter Error:", error);
        ctx.reply("❌ Failed to post tweet.");
      }
    } else if (action === "reject") {
      ctx.reply("❌ Tweet rejected.");
    }
  } else {
    ctx.reply("⚠️ Tweet not found or already processed.");
  }
  ctx.answerCbQuery();
});

export { generateTweet, suggestTweetEnhancements, sendTweetForApproval, getMyFollowedAccounts };
