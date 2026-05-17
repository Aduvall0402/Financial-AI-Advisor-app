#!/bin/sh
cd wealthpal-ai/wealthpal-backend || exit 1
npm install
npm run build
npm start
