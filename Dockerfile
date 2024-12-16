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
