# Dockerized Lambda with Puppeteer

This repository demonstrates how to create a Dockerized AWS Lambda function using Puppeteer to generate PDFs from a URL. The Lambda function is packaged into a Docker container and can be deployed to AWS Lambda.

Structure
The project has the following structure:

```
/lambda-pdf-generator
├── Dockerfile
├── src
│   ├── app.js
│   └── package.json
```

## 1. Dockerfile
This Dockerfile defines the container image for the Lambda function. It uses the official AWS Lambda Node.js base image and installs necessary dependencies for Puppeteer.
```docker
# Use the AWS Lambda Node.js 18 base image
FROM public.ecr.aws/lambda/nodejs:18

# Install dependencies required for Chromium and Puppeteer
RUN yum -y install \
    atk \
    cups-libs \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXtst \
    pango \
    alsa-lib \
    gtk3 \
    ipa-gothic-fonts \
    xorg-x11-fonts-100dpi \
    xorg-x11-fonts-75dpi \
    xorg-x11-utils \
    xorg-x11-fonts-cyrillic \
    xorg-x11-fonts-misc \
    xorg-x11-fonts-Type1 \
    xorg-x11-server-utils \
    libXScrnSaver \
    wget \
    tar \
    bzip2 \
    unzip \
    && yum clean all

# Download and install a specific version of Chromium (Revision 1084778)
RUN wget https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/1084778/chrome-linux.zip && \
    unzip chrome-linux.zip && \
    mv chrome-linux /usr/local/chromium && \
    rm -rf chrome-linux.zip

# Add Chromium to PATH
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/local/chromium/chrome

# Copy package.json and package-lock.json for dependency installation
COPY src/package.json ./

# Install Puppeteer and its dependencies
RUN npm install --omit=dev --omit=optional && npm cache clean --force

# Copy application code
COPY src/app.js ./

# Set the Lambda function handler
CMD ["app.handler"]
```

## 2. src/app.js
This is the Lambda function code. It uses Puppeteer to generate a PDF from a URL and injects a title into the metadata.
```js
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
```

## 3. src/package.json
The package.json file contains the dependencies for the Lambda function. In this case, we need puppeteer-core to generate PDFs from URLs.
```json
{
  "name": "lambda-pdf",
  "version": "1.0.0",
  "author": "",
  "license": "ISC",
  "description": "A Node.js app running Puppeteer on AWS Lambda",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "puppeteer": "19.11.1"
  }
}
```
