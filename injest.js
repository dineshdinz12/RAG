const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');
require('dotenv').config();


const turndownService = new TurndownService();
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});


function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

async function crawlPage(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const browser = await puppeteer.launch({ 
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            
            await page.goto(url, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
            
            const content = await page.evaluate(() => {
                const unwanted = document.querySelectorAll('script, style, nav, footer, header, iframe');
                unwanted.forEach(el => el.remove());
                
                const main = document.querySelector('main') || document.body;
                return main.innerHTML;
            });
            
            await browser.close();
            
            const dom = new JSDOM(content);
            const mainContent = dom.window.document.body.textContent;
            return turndownService.turndown(cleanText(mainContent));
            
        } catch (error) {
            console.error(`Attempt ${attempt} failed for ${url}:`, error);
            if (attempt === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
}

async function ingestData() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const index = pinecone.index('bitsathy-data');
        
        const baseUrls = [
            'https://www.bitsathy.ac.in/',
            'https://www.bitsathy.ac.in/milestones/',
            'https://www.bitsathy.ac.in/department/',
            'https://www.bitsathy.ac.in/programmes-offered/',
            'https://www.bitsathy.ac.in/achievement/'
        ];

        const batchSize = 10;
        let vectors = [];
        
        for (const url of baseUrls) {
            console.log(`Processing ${url}`);
            try {
                const pageContent = await crawlPage(url);
                const chunks = pageContent.match(/.{1,1000}/g) || [];
                
                for (let i = 0; i < chunks.length; i++) {
                    const embedResult = await embedModel.embedContent(chunks[i]);
                    const embedding = Array.from(await embedResult.embedding.values);
                    
                    vectors.push({
                        id: `${url.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`,
                        values: embedding,
                        metadata: {
                            url,
                            content: chunks[i],
                            timestamp: new Date().toISOString()
                        }
                    });
                    
                    if (vectors.length >= batchSize) {
                        console.log(`Upserting batch of ${vectors.length} vectors...`);
                        await index.upsert(vectors);
                        console.log('Batch upsert complete');
                        vectors = [];
                    }
                }
            } catch (error) {
                console.error(`Error processing ${url}:`, error);
                continue;
            }
        }
        
        if (vectors.length > 0) {
            console.log(`Upserting final batch of ${vectors.length} vectors...`);
            await index.upsert(vectors);
            console.log('Final batch upsert complete');
        }
        
        console.log('Ingestion complete');
        
    } catch (error) {
        console.error('Fatal error during ingestion:', error);
        process.exit(1);
    }
}

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

ingestData();