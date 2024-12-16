const puppeteer = require('puppeteer');

const createBrowserInstance = async () => {
    return await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    });
};

const generatePdf = async (page, content, pdfConfig) => {
    if (content.url) {
        await page.goto(content.url, { waitUntil: 'networkidle2' });
    } else {
        await page.setContent(content.html);
    }

    return await page.pdf({
        format: 'A4',
        printBackground: true,
        ...pdfConfig,
    });
};

const sendPdfResponse = (pdfBuffer, fileName) => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName || 'output.pdf'}"`,
    },
    body: pdfBuffer.toString('base64'),
    isBase64Encoded: true,
});

const processPostRequest = async (page, body) => {
    let pdfBuffer;

    if (body.pdfContent) {
        pdfBuffer = await generatePdf(page, { html: body.pdfContent }, body.pdfConfig);
    } else if (body.pdfUrl) {
        pdfBuffer = await generatePdf(page, { url: body.pdfUrl }, body.pdfConfig);
    }

    return pdfBuffer ? sendPdfResponse(pdfBuffer, body.fileName) : {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
};

const processGetRequest = async (page, queryString) => {
    const payload = JSON.parse(decodeURI(queryString.pdf));

    if (payload.content) {
        const pdfBuffer = await generatePdf(page, { html: payload.content }, payload.config);
        return sendPdfResponse(pdfBuffer, payload.fileName);
    }

    if (payload.url) {
        const pdfBuffer = await generatePdf(page, { url: payload.url }, payload.config);
        return sendPdfResponse(pdfBuffer, payload.fileName);
    }

    return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid query parameters' }),
    };
};

exports.handler = async (event) => {
    let browser;
    try {
        browser = await createBrowserInstance();
        const page = await browser.newPage();

        if (event?.requestContext?.http?.method === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {};
            return await processPostRequest(page, body);
        }

        if (event?.requestContext?.http?.method === 'GET' && event?.queryStringParameters?.pdf) {
            return await processGetRequest(page, event.queryStringParameters);
        }

        // Default case: generate PDF from simple HTML content
        const pdfBuffer = await generatePdf(page, { html: '<h1>Hello, PDF World!</h1>' }, {});
        return sendPdfResponse(pdfBuffer);

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
