import { ComprehendClient, DetectSentimentCommand } from "@aws-sdk/client-comprehend";
import dotenv from "dotenv";

dotenv.config();

// The SDK automatically uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from your .env
const comprehendClient = new ComprehendClient({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined
});

/**
 * Analyzes the description text and returns true if it is overwhelmingly negative.
 */
export async function isHighlyNegative(text) {
    if (!text) return false;

    // Truncate to the first 1,000 characters to protect your Free Tier limits
    const truncatedText = text.substring(0, 1000);

    const command = new DetectSentimentCommand({
        LanguageCode: "en", // Assuming English grievances
        Text: truncatedText,
    });

    try {
        const response = await comprehendClient.send(command);
        
        // Check if sentiment is NEGATIVE and the confidence score is above 80%
        if (
            response.Sentiment === "NEGATIVE" && 
            response.SentimentScore?.Negative > 0.80
        ) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("AWS Comprehend Error:", error);
        // If AWS fails for any reason, safely return false so the grievance still saves normally
        return false; 
    }
}
