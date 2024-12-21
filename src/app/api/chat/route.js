import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

export async function POST(req) {
    try {
        const { messages } = await req.json();
        
        if (!messages?.length) {
            return new Response(
                JSON.stringify({ error: 'No messages provided' }), 
                { status: 400 }
            );
        }

        const lastMessage = messages[messages.length - 1];
        
        const chatModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        const generalPrompt = `You are a helpful assistant for BIT Sathy (Bannari Amman Institute of Technology).
        Answer this question with your general knowledge. If you need specific data about BIT Sathy,
        let me know and I'll provide it. Question: "${lastMessage.content}"`;

        try {
            const generalResponse = await chatModel.generateContent(generalPrompt);
            const responseText = generalResponse.response.text();
            

            if (responseText.toLowerCase().includes("specific") || 
                responseText.toLowerCase().includes("exact") ||
                responseText.toLowerCase().includes("please check")) {
          
                const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });
                const queryEmbedding = await embedModel.embedContent(lastMessage.content);
                
                const index = pinecone.index('bitsathy-data');
                const queryResponse = await index.query({
                    vector: queryEmbedding.embedding,
                    topK: 5,
                    includeMetadata: true
                });

                const relevantDocs = queryResponse.matches
                    .filter(match => match.score > 0.7)
                    .map(match => ({
                        content: match.metadata.content,
                        url: match.metadata.url,
                        score: match.score
                    }));

                if (relevantDocs.length > 0) {
                    const contextPrompt = `You are a helpful assistant for BIT Sathy.
                    Use these sources to answer the question:

                    ${relevantDocs.map((doc, i) => 
                        `Source ${i + 1} (${(doc.score * 100).toFixed(1)}% relevant):
                        From: ${doc.url}
                        Content: ${doc.content}`
                    ).join('\n\n')}

                    Previous messages:
                    ${messages.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}

                    Current question: ${lastMessage.content}

                    Instructions:
                    1. Answer using the provided sources and your general knowledge
                    2. If information is missing or unclear, say so
                    3. Cite sources when relevant
                    4. Be professional and helpful

                    Answer:`;

                    const contextResponse = await chatModel.generateContentStream(contextPrompt);
                    return new Response(contextResponse.stream(), {
                        headers: { 'Content-Type': 'text/plain' }
                    });
                }
            }
            
            return new Response(responseText, {
                headers: { 'Content-Type': 'text/plain' }
            });

        } catch (error) {
            console.error('AI generation error:', error);
            throw error;
        }

    } catch (error) {
        console.error('Chat error:', error);
        return new Response(
            JSON.stringify({ 
                error: 'Failed to process request',
                details: error.message 
            }), 
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
